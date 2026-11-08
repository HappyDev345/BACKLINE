import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-security-worker-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type SecurityAlert = {
  event_id: string
  event_type: string
  outcome: string
  severity: string
  reason_code: string | null
  occurred_at: string
  actor_user_id: string | null
  target_type: string | null
  target_id: string | null
  attempt_count: number
  actor_display_name: string | null
  actor_username: string | null
  target_display_name: string | null
  target_username: string | null
  project_title: string | null
  content_title: string | null
  content_excerpt: string | null
}

function jsonResponse(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function safeEmbedText(value: string, limit: number) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/https?:\/\//gi, (scheme) => scheme.replace(':', '[:]'))
    .replace(/([\\*_~`|>])/g, '\\$1')
    .replace(/@/g, '@\u200b')
    .slice(0, limit)
}

function alertEmbed(event: SecurityAlert) {
  const isError = ['denied', 'failed', 'rejected'].includes(event.outcome)
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: 'Outcome', value: safeEmbedText(event.outcome, 64), inline: true },
    { name: 'Severity', value: safeEmbedText(event.severity, 64), inline: true },
  ]

  if (event.actor_user_id) {
    const nameParts = [event.actor_display_name, event.actor_username ? `@${event.actor_username}` : null]
      .filter((part): part is string => Boolean(part))
    const actorLabel = nameParts.length ? safeEmbedText(nameParts.join(' · '), 200) : 'Account'
    fields.push({
      name: 'Actor',
      value: `${actorLabel}\nID: ${event.actor_user_id}`,
    })
  }
  if (event.project_title) {
    fields.push({ name: 'Project', value: safeEmbedText(event.project_title, 1024) })
  }
  if (event.content_title) {
    fields.push({ name: 'Post title', value: safeEmbedText(event.content_title, 256) })
  }
  if (event.content_excerpt) {
    const excerptLabel = event.event_type === 'report.created' ? 'Report details excerpt' : 'Content excerpt'
    fields.push({ name: excerptLabel, value: safeEmbedText(event.content_excerpt, 600) })
  }
  if (event.target_type && event.target_id) {
    const targetNameParts = [event.target_display_name, event.target_username ? `@${event.target_username}` : null]
      .filter((part): part is string => Boolean(part))
    const targetLabel = targetNameParts.length ? ` · ${safeEmbedText(targetNameParts.join(' · '), 200)}` : ''
    fields.push({
      name: 'Target',
      value: `${safeEmbedText(event.target_type, 64)}${targetLabel}\nID: ${event.target_id}`,
    })
  }
  if (event.reason_code) {
    fields.push({ name: 'Reason', value: safeEmbedText(event.reason_code, 128) })
  }

  return {
    title: safeEmbedText(event.event_type, 256),
    color: isError ? 0xed4245 : 0x57f287,
    timestamp: event.occurred_at,
    fields,
    footer: { text: `Event ${event.event_id}` },
  }
}

async function retryAfterSeconds(response: Response) {
  const retryAfter = response.headers.get('Retry-After')
    ?? response.headers.get('X-RateLimit-Reset-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.max(0, Math.min(300, Math.ceil(seconds)))
    const dateDelay = Date.parse(retryAfter) - Date.now()
    if (Number.isFinite(dateDelay)) return Math.max(0, Math.min(300, Math.ceil(dateDelay / 1000)))
  }

  try {
    const payload = await response.clone().json() as { retry_after?: unknown }
    if (typeof payload.retry_after === 'number' && Number.isFinite(payload.retry_after)) {
      return Math.max(0, Math.min(300, Math.ceil(payload.retry_after)))
    }
  } catch {
    // Use a conservative fallback when Discord doesn't return a readable delay.
  }
  return 2
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' })

  const workerSecret = Deno.env.get('SECURITY_WORKER_SECRET')
  const webhookUrl = Deno.env.get('DISCORD_SECURITY_WEBHOOK_URL')
  const serviceUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!workerSecret || !webhookUrl || !serviceUrl || !serviceRoleKey) {
    console.error('Discord security alert worker is missing required server configuration.')
    return jsonResponse(503, { error: 'The security alert worker is not configured.' })
  }
  if (request.headers.get('x-security-worker-secret') !== workerSecret) {
    return jsonResponse(401, { error: 'Not authorized.' })
  }

  let webhook: URL
  try {
    webhook = new URL(webhookUrl)
  } catch {
    console.error('Discord security webhook URL is invalid.')
    return jsonResponse(503, { error: 'The security alert worker is not configured.' })
  }
  if (webhook.protocol !== 'https:'
    || !['discord.com', 'discordapp.com'].includes(webhook.hostname)
    || !webhook.pathname.startsWith('/api/webhooks/')) {
    console.error('Discord security webhook must use an official HTTPS Discord host.')
    return jsonResponse(503, { error: 'The security alert worker is not configured.' })
  }

  const service = createClient(serviceUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  let deliveryFailures = 0
  let processed = 0
  const startedAt = Date.now()
  const maxRunMilliseconds = 50_000
  while (Date.now() - startedAt < maxRunMilliseconds) {
    const { data: alerts, error: claimError } = await service.rpc('claim_security_alerts', { batch_size: 1 })
    if (claimError) {
      console.error('Discord security alert queue could not be claimed.')
      return jsonResponse(500, { error: 'Security alerts could not be processed.' })
    }

    const alert = (alerts || [])[0] as SecurityAlert | undefined
    if (!alert) {
      const { data: stateRows, error: stateError } = await service.rpc('security_alert_dispatch_state')
      if (stateError) {
        console.error('Discord security alert queue state could not be read.')
        return jsonResponse(500, { error: 'Security alerts could not be processed.' })
      }

      const state = stateRows?.[0] as {
        pending_alert_count: number
        wait_seconds: number
      } | undefined
      if (!state || Number(state.pending_alert_count) === 0) break

      const waitMilliseconds = Math.max(1, Number(state.wait_seconds) || 1) * 1000
      if (Date.now() - startedAt + waitMilliseconds >= maxRunMilliseconds) break
      await delay(waitMilliseconds)
      continue
    }

    let deliverySucceeded = false
    let failureCode: string | null = null
    let retryDelaySeconds: number | null = null
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [alertEmbed(alert)],
          allowed_mentions: { parse: [] },
        }),
      })
      if (response.ok) {
        deliverySucceeded = true
      } else {
        failureCode = response.status === 429
          ? 'discord_http_429'
          : response.status >= 500 ? 'discord_http_5xx' : 'discord_http_4xx'
        if (response.status === 429) retryDelaySeconds = await retryAfterSeconds(response)
      }
    } catch {
      failureCode = 'discord_network_error'
    }

    const { error: completionError } = await service.rpc('complete_security_alert', {
      event_uuid: alert.event_id,
      delivery_succeeded: deliverySucceeded,
      failure_code: failureCode,
      retry_after_seconds: retryDelaySeconds,
    })
    if (completionError) {
      deliveryFailures++
      console.error('Discord security alert delivery status could not be recorded.')
    } else if (!deliverySucceeded) {
      deliveryFailures++
    }
    processed++
  }

  const { data: stateRows, error: stateError } = await service.rpc('security_alert_dispatch_state')
  if (stateError) {
    console.error('Discord security alert queue state could not be read after processing.')
    return jsonResponse(500, { error: 'Security alerts could not be processed.' })
  }
  const pendingCount = Number(stateRows?.[0]?.pending_alert_count || 0)

  if (deliveryFailures) {
    return jsonResponse(502, { error: 'One or more security alerts could not be delivered.' })
  }
  return jsonResponse(200, {
    message: `Processed ${processed} security alert(s); ${pendingCount} alert(s) remain pending.`,
  })
})
