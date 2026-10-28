// Finds the existing private conversation between two people, or creates one
// and adds both people to it. This helper is used when someone starts a message.
export async function findOrCreateConversation(supabase, meId, otherId) {
  // First collect conversations that already include the person starting the chat.
  const { data: mine, error: mineError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', meId)
  if (mineError) throw mineError

  const ids = (mine || []).map(r => r.conversation_id)
  if (ids.length) {
    // If the other person shares one of those conversations, reuse it.
    const { data: shared, error: sharedError } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .in('conversation_id', ids)
      .eq('user_id', otherId)
    if (sharedError) throw sharedError
    if (shared && shared.length) return shared[0].conversation_id
  }

  // The database verifies the caller and adds both members atomically.
  const { data: conversationId, error } = await supabase.rpc('create_conversation', { other_user: otherId })
  if (error) throw error
  return conversationId
}
