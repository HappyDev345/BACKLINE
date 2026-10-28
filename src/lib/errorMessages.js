// Convert backend failures into concise messages that are safe to show visitors.
export function getUserFacingError(error, fallback) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : ''
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''

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
  if (error instanceof TypeError || message.includes('failed to fetch') || message.includes('network')) {
    return 'We couldn’t connect right now. Check your connection and try again.'
  }

  return fallback
}
