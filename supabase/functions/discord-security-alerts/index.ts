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
}

function jsonResponse(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function alertText(event: SecurityAlert) {
  const lines = [
    `[${event.severity.toUpperCase()}] ${event.event_type} (${event.outcome})`,
    `Event: ${event.event_id}`,
    `Occurred: ${event.occurred_at}`,
  ]
  if (event.reason_code) lines.push(`Reason: ${event.reason_code}`)
  if (event.actor_user_id) lines.push(`Actor ID: ${event.actor_user_id}`)
  if (event.target_type && event.target_id) lines.push(`Target: ${event.target_type} ${event.target_id}`)
  return lines.join('\n')
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
  const { data: alerts, error: claimError } = await service.rpc('claim_security_alerts', { batch_size: 10 })
  if (claimError) {
    console.error('Discord security alert queue could not be claimed.')
    return jsonResponse(500, { error: 'Security alerts could not be processed.' })
  }

  let deliveryFailures = 0
  for (const alert of (alerts || []) as SecurityAlert[]) {
    let deliverySucceeded = false
    let failureCode: string | null = null
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: alertText(alert),
          allowed_mentions: { parse: [] },
        }),
      })
      if (response.ok) {
        deliverySucceeded = true
      } else {
        failureCode = response.status === 429
          ? 'discord_http_429'
          : response.status >= 500 ? 'discord_http_5xx' : 'discord_http_4xx'
      }
    } catch {
      failureCode = 'discord_network_error'
    }

    const { error: completionError } = await service.rpc('complete_security_alert', {
      event_uuid: alert.event_id,
      delivery_succeeded: deliverySucceeded,
      failure_code: failureCode,
    })
    if (completionError) {
      deliveryFailures++
      console.error('Discord security alert delivery status could not be recorded.')
    } else if (!deliverySucceeded) {
      deliveryFailures++
    }
  }

  if (deliveryFailures) {
    return jsonResponse(502, { error: 'One or more security alerts could not be delivered.' })
  }
  return jsonResponse(200, { message: `Processed ${(alerts || []).length} security alert(s).` })
})
