import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-avatar-cleanup-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(status: number, body: Record<string, number | string | boolean>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isExpiredAvatarObject(value: unknown): value is { object_name: string } {
  return typeof value === 'object'
    && value !== null
    && 'object_name' in value
    && typeof value.object_name === 'string'
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' })

  const workerSecret = Deno.env.get('AVATAR_CLEANUP_SECRET')
  const serviceUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!workerSecret || !serviceUrl || !serviceRoleKey) {
    console.error('Avatar quarantine cleanup is missing server configuration.')
    return jsonResponse(503, { error: 'Avatar cleanup is not configured.' })
  }
  if (request.headers.get('x-avatar-cleanup-secret') !== workerSecret) {
    return jsonResponse(401, { error: 'Not authorized.' })
  }

  const service = createClient(serviceUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  let inspected = 0
  let removed = 0
  const maxInspected = 1000
  let morePending = false

  while (inspected < maxInspected) {
    const batchSize = Math.min(100, maxInspected - inspected)
    const { data: objects, error: listError } = await service.rpc('list_expired_avatar_quarantine_objects', {
      batch_size: batchSize,
    })
    if (listError) {
      console.error('Avatar quarantine objects could not be listed.')
      return jsonResponse(500, { error: 'Avatar quarantine cleanup failed.' })
    }
    if (!Array.isArray(objects)) {
      console.error('Avatar quarantine cleanup returned an invalid object list.')
      return jsonResponse(500, { error: 'Avatar quarantine cleanup failed.' })
    }
    const objectRows = objects.filter(isExpiredAvatarObject)
    if (objectRows.length !== objects.length) {
      console.error('Avatar quarantine cleanup returned an invalid object list.')
      return jsonResponse(500, { error: 'Avatar quarantine cleanup failed.' })
    }
    if (objectRows.length === 0) {
      morePending = false
      break
    }

    const paths = objectRows.map((object) => object.object_name)
    const { error: removeError } = await service.storage.from('avatar-quarantine').remove(paths)
    if (removeError) {
      console.error('Stale avatar quarantine objects could not be removed.')
      return jsonResponse(500, { error: 'Avatar quarantine cleanup failed.' })
    }

    inspected += paths.length
    removed += paths.length
    for (const path of paths) {
      const uploadId = path.split('/').pop() || ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploadId)) continue
      const { error: auditError } = await service.rpc('log_upload_security_event', {
        event_name: 'upload.deleted',
        event_result: 'completed',
        severity_level: 'info',
        reason: 'quarantine_expired',
        account_uuid: null,
        upload_uuid: uploadId,
        media_type: 'unknown',
        byte_size: 0,
      })
      if (auditError) {
        console.error('An expired quarantine cleanup event could not be recorded.')
        return jsonResponse(500, { error: 'Avatar quarantine cleanup event recording failed.' })
      }
    }

    morePending = paths.length === batchSize
    if (!morePending) break
  }

  return jsonResponse(200, {
    inspected,
    removed,
    more_pending: morePending,
  })
})
