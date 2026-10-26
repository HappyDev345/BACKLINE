// The database verifies membership and creates or reuses a direct conversation.
export async function findOrCreateConversation(supabase, otherId) {
  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    target_user_id: otherId,
  })
  if (error) throw error
  return data
}
