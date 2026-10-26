import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' })

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'A valid sign-in is required.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Account deletion function is missing Supabase environment configuration.')
    return jsonResponse(500, { error: 'Account deletion is not configured.' })
  }

  const token = authorization.slice('Bearer '.length)
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser(token)
  if (authError || !user) return jsonResponse(401, { error: 'A valid sign-in is required.' })

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const bucket = adminClient.storage.from('media')
  const pendingFolders = [user.id]
  const objectPaths: string[] = []

  while (pendingFolders.length > 0) {
    const folder = pendingFolders.pop()!
    let offset = 0
    while (true) {
      const { data: items, error: listError } = await bucket.list(folder, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (listError) {
        console.error('Failed to list account media before deletion:', listError.message)
        return jsonResponse(500, { error: 'Could not remove uploaded media. Your account was not deleted.' })
      }
      if (!items?.length) break

      for (const item of items) {
        const path = `${folder}/${item.name}`
        if (item.id === null) pendingFolders.push(path)
        else objectPaths.push(path)
      }
      if (items.length < 100) break
      offset += items.length
    }
  }

  for (let start = 0; start < objectPaths.length; start += 100) {
    const { error: removeError } = await bucket.remove(objectPaths.slice(start, start + 100))
    if (removeError) {
      console.error('Failed to remove account media before deletion:', removeError.message)
      return jsonResponse(500, { error: 'Could not remove uploaded media. Your account was not deleted.' })
    }
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('Failed to delete authenticated account:', deleteError.message)
    return jsonResponse(500, { error: 'The account could not be deleted. Please try again.' })
  }

  return jsonResponse(200, { message: 'Account deleted.' })
})
