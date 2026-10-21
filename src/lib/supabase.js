// Supabase is the online database and account service used by the full app.
// Both settings are required; if either is missing, the site uses sample data.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Pages check this flag before choosing between online data and preview data.
export const isDemoMode = !url || !key
export const supabase = isDemoMode ? null : createClient(url, key)
