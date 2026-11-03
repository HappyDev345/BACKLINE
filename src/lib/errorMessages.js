import { isDemoMode, supabase } from './supabase'

function classifyError(error) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : ''
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''

  if (error instanceof TypeError || message.includes('failed to fetch') || message.includes('network')) {
    return 'network_error'
  }
  if (code === 'p0001' || message.includes('sending messages too quickly')) {
    return 'rate_limited'
  }
  if (code === '42501' || code === '401' || code === '403') {
    return 'permission_denied'
  }
  if (code.startsWith('23')) {
    return 'constraint_error'
  }
  if (code.includes('auth') || code === 'invalid_credentials' || code === 'email_not_confirmed') {
    return 'auth_error'
  }
  return 'request_failed'
}

function operationKey(fallback) {
  const key = fallback.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32)
  return /^[a-z]/.test(key) ? key : 'user_operation'
}

export function recordClientError(error, operation, categoryOverride) {
  if (isDemoMode || !supabase) return

  void supabase.auth.getSession()
    .then(({ data, error: sessionError }) => {
      if (sessionError) {
        console.warn('Sanitized client error event could not check the current session.')
        return null
      }
      if (!data.session) return null

      return supabase.rpc('log_client_error', {
        operation_key: operationKey(operation),
        error_category: categoryOverride || classifyError(error),
      })
    })
    .then((result) => {
      if (result?.error) console.warn('Sanitized client error event could not be recorded.')
    })
    .catch(() => {
      console.warn('Sanitized client error event could not be recorded.')
    })
}

// Convert backend failures into concise messages that are safe to show visitors.
export function getUserFacingError(error, fallback) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : ''
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''

  recordClientError(error, fallback)

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'We couldn’t sign you in. Check your email and password, then try again.'
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.'
  }
  if (code === 'weak_password' || message.includes('password should be')) {
    return 'Choose a stronger password and try again.'
  }
  if (code === 'user_already_exists' || message.includes('user already registered')) {
    return 'An account may already exist for this email. Try signing in or resetting your password.'
  }
  if (code === '23505' && message.includes('reports_one_open_per_reporter_target')) {
    return 'You already have an open report for this item.'
  }
  if (code === 'p0001' && message.includes('sending messages too quickly')) {
    return 'You’re sending messages too quickly. Please wait a moment before trying again.'
  }
  if (error instanceof TypeError || message.includes('failed to fetch') || message.includes('network')) {
    return 'We couldn’t connect right now. Check your connection and try again.'
  }

  return fallback
}
