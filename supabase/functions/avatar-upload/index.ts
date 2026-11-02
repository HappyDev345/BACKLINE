import { createClient } from 'npm:@supabase/supabase-js@2'
import { Image } from 'npm:imagescript@3.13.1'
import { inspectImage, isWithinImageLimits } from './imageValidation.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type UploadEvent = 'upload.received' | 'upload.rejected' | 'upload.accepted' | 'upload.failed' | 'upload.deleted'

function jsonResponse(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function readLimitedBody(request: Request) {
  if (!request.body) throw new Error('missing_body')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_UPLOAD_BYTES) {
      await reader.cancel()
      throw new Error('too_large')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function ownedMediaPath(publicUrl: string | null, serviceUrl: string, userId: string) {
  if (!publicUrl) return null
  try {
    const url = new URL(publicUrl)
    if (url.origin !== new URL(serviceUrl).origin) return null
    const prefix = '/storage/v1/object/public/media/'
    if (!url.pathname.startsWith(prefix)) return null
    const path = decodeURIComponent(url.pathname.slice(prefix.length))
    if (!path.startsWith(`${userId}/`) || path.split('/').some((part) => !part || part === '.' || part === '..')) return null
    return path
  } catch {
    return null
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' })

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'A valid sign-in is required.' })
  }

  const serviceUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceUrl || !anonKey || !serviceRoleKey) {
    console.error('Avatar upload is missing Supabase environment configuration.')
    return jsonResponse(500, { error: 'Avatar upload is not configured.' })
  }

  const accessToken = authorization.slice('Bearer '.length)
  const authClient = createClient(serviceUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken)
  if (authError || !user) return jsonResponse(401, { error: 'A valid sign-in is required.' })

  const verifiedUser = user
  const adminClient = createClient(serviceUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const uploadId = crypto.randomUUID()
  const quarantinePath = `${verifiedUser.id}/${uploadId}`
  const declaredType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() || ''
  const eventMediaType = ALLOWED_TYPES.has(declaredType) ? declaredType : 'unknown'
  let quarantineCreated = false
  let publicPath: string | null = null
  let profileUpdated = false
  let processedMediaType = eventMediaType
  let uploadByteSize = 0

  async function logEvent(
    eventName: UploadEvent,
    outcome: 'accepted' | 'rejected' | 'failed' | 'completed',
    severity: 'info' | 'medium' | 'high',
    reason: string,
    mediaType = eventMediaType,
    byteSize = 0,
  ) {
    const { error } = await adminClient.rpc('log_upload_security_event', {
      event_name: eventName,
      event_result: outcome,
      severity_level: severity,
      reason,
      account_uuid: verifiedUser.id,
      upload_uuid: uploadId,
      media_type: mediaType,
      byte_size: byteSize,
    })
    if (error) throw new Error('audit_write_failed')
  }

  async function recordCleanupFailure(reason: string) {
    try {
      await logEvent('upload.failed', 'failed', 'medium', reason)
    } catch {
      console.error('Avatar cleanup failure could not be written to the security event store.')
    }
  }

  async function reject(status: number, reason: string, message: string, mediaType = eventMediaType, byteSize = 0) {
    await logEvent('upload.rejected', 'rejected', 'medium', reason, mediaType, byteSize)
    return jsonResponse(status, { error: message })
  }

  try {
    await logEvent('upload.received', 'accepted', 'info', 'received')

    const { data: restriction, error: restrictionError } = await adminClient
      .from('account_restrictions')
      .select('suspended')
      .eq('user_id', verifiedUser.id)
      .maybeSingle()
    if (restrictionError) throw new Error('account_status_check_failed')
    if (restriction?.suspended) {
      return await reject(403, 'account_suspended', 'This account cannot update its profile image.')
    }

    const contentLength = Number(request.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
      return await reject(413, 'file_too_large', 'Choose an image smaller than 5 MB.')
    }
    if (!ALLOWED_TYPES.has(declaredType)) {
      return await reject(415, 'unsupported_type', 'Choose a JPEG, PNG, or WebP image.')
    }

    const { data: slotAvailable, error: quotaError } = await adminClient.rpc('claim_avatar_upload_slot', {
      account_uuid: verifiedUser.id,
    })
    if (quotaError) throw new Error('upload_quota_check_failed')
    if (!slotAvailable) {
      return await reject(429, 'rate_limit', 'You have uploaded several profile images recently. Please try again later.')
    }

    let bytes: Uint8Array
    try {
      bytes = await readLimitedBody(request)
    } catch (error) {
      if (error instanceof Error && error.message === 'too_large') {
        return await reject(413, 'file_too_large', 'Choose an image smaller than 5 MB.')
      }
      if (error instanceof Error && error.message === 'missing_body') {
        return await reject(400, 'empty_upload', 'Choose an image to upload.')
      }
      throw error
    }
    if (bytes.byteLength === 0) {
      return await reject(400, 'empty_upload', 'Choose an image to upload.')
    }
    uploadByteSize = bytes.byteLength

    const inspected = inspectImage(bytes)
    if (!inspected) {
      return await reject(415, 'invalid_image', 'The selected file is not a supported image.', 'unknown', bytes.byteLength)
    }
    if (inspected.mediaType !== declaredType) {
      return await reject(415, 'mime_mismatch', 'The selected file type does not match its contents.', inspected.mediaType, bytes.byteLength)
    }
    processedMediaType = inspected.mediaType
    if (!isWithinImageLimits(inspected.width, inspected.height)) {
      return await reject(413, 'dimensions_exceeded', 'Choose an image with a maximum side of 4096 pixels and no more than 8 megapixels.', inspected.mediaType, bytes.byteLength)
    }

    const { error: quarantineError } = await adminClient.storage
      .from('avatar-quarantine')
      .upload(quarantinePath, bytes, { contentType: inspected.mediaType, upsert: false })
    if (quarantineError) throw new Error('quarantine_storage_failed')
    quarantineCreated = true

    let image: Image
    try {
      image = await Image.decode(bytes)
    } catch {
      return await reject(415, 'decode_failed', 'The selected image could not be safely processed.', inspected.mediaType, bytes.byteLength)
    }
    if (image.width !== inspected.width || image.height !== inspected.height) {
      return await reject(415, 'dimension_mismatch', 'The selected image could not be safely processed.', inspected.mediaType, bytes.byteLength)
    }

    if (Math.max(image.width, image.height) > 1024) {
      const scale = 1024 / Math.max(image.width, image.height)
      image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)))
    }
    const normalizedBytes = await image.encode()
    if (normalizedBytes.byteLength > MAX_UPLOAD_BYTES) {
      return await reject(413, 'normalized_image_too_large', 'The processed image is too large to publish.', inspected.mediaType, bytes.byteLength)
    }

    publicPath = `${verifiedUser.id}/${uploadId}.png`
    const { error: publishError } = await adminClient.storage.from('media').upload(
      publicPath,
      normalizedBytes,
      { contentType: 'image/png', upsert: false },
    )
    if (publishError) throw new Error('public_storage_failed')

    await logEvent('upload.accepted', 'accepted', 'info', 'image_reencoded', 'image/png', normalizedBytes.byteLength)
    const { data: previousProfile, error: profileReadError } = await adminClient
      .from('profiles').select('avatar_url').eq('id', verifiedUser.id).maybeSingle()
    if (profileReadError || !previousProfile) throw new Error('profile_read_failed')

    const { data: updatedProfile, error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({ avatar_url: adminClient.storage.from('media').getPublicUrl(publicPath).data.publicUrl })
      .eq('id', verifiedUser.id)
      .select('id')
      .single()
    if (profileUpdateError || !updatedProfile) throw new Error('profile_update_failed')
    profileUpdated = true

    const previousPath = ownedMediaPath(previousProfile.avatar_url, serviceUrl, verifiedUser.id)
    if (previousPath && previousPath !== publicPath) {
      try {
        const { error: oldObjectError } = await adminClient.storage.from('media').remove([previousPath])
        if (oldObjectError) throw new Error('old_avatar_cleanup_failed')
      } catch {
        console.error('A replaced avatar could not be removed from public storage.')
        await recordCleanupFailure('old_avatar_cleanup_failed')
      }
    }

    return jsonResponse(200, { message: 'Avatar updated.' })
  } catch {
    console.error('Avatar upload operation failed.')
    if (publicPath && !profileUpdated) {
      try {
        const { error: removeError } = await adminClient.storage.from('media').remove([publicPath])
        if (removeError) console.error('An unpublished avatar could not be removed from public storage.')
      } catch {
        console.error('An unpublished avatar could not be removed from public storage.')
      }
    }
    try {
      await logEvent('upload.failed', 'failed', 'high', 'processing_failure')
    } catch {
      console.error('Avatar upload failure could not be written to the security event store.')
    }
    return jsonResponse(500, { error: 'We could not safely process that image. Please try again.' })
  } finally {
    if (quarantineCreated) {
      try {
        const { error: cleanupError } = await adminClient.storage.from('avatar-quarantine').remove([quarantinePath])
        if (cleanupError) {
          console.error('A processed avatar could not be removed from private quarantine.')
          await recordCleanupFailure('quarantine_cleanup_failed')
        } else {
          try {
            await logEvent('upload.deleted', 'completed', 'info', 'quarantine_cleanup', processedMediaType, uploadByteSize)
          } catch {
            console.error('Avatar quarantine cleanup event could not be written to the security event store.')
          }
        }
      } catch {
        console.error('A processed avatar could not be removed from private quarantine.')
        await recordCleanupFailure('quarantine_cleanup_failed')
      }
    }
  }
})
