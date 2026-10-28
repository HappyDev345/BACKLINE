// Shows a list of private conversations and the messages in the selected one.
// Connected accounts receive new messages live; preview messages stay in memory.
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import { timeAgo } from '../lib/utils'
import { getUserFacingError } from '../lib/errorMessages'
import Avatar from '../components/Avatar'
import ReportButton from '../components/ReportButton'

export default function MessagesPage({ promptSignIn }) {
  const { session, profile } = useAuth()
  const demo = useDemoData()
  const location = useLocation()
  const [convs, setConvs] = useState([])
  const [active, setActive] = useState(location.state?.open || null)
  const [others, setOthers] = useState({})
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { if (session) loadConvs() }, [session])

  useEffect(() => {
    if (!active) return
    loadMsgs()
    // Supabase subscriptions keep the open conversation up to date in real time.
    if (isDemoMode) return
    const ch = supabase.channel('conv-' + active)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + active },
        () => {
          loadMsgs()
          loadConvs()
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [active])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function loadConvs() {
    setError('')
    // Preview conversations already include the other person's profile and last message.
    if (isDemoMode) {
      const list = demo.conversations
      setOthers(Object.fromEntries(list.map((conversation) => [conversation.id, conversation.other])))
      setConvs(list)
      if (!active && list.length) setActive(list[0].id)
      return
    }
    try {
      const { data: mem, error: membersError } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', session.user.id)
      if (membersError) throw membersError
      const ids = (mem || []).map(r => r.conversation_id)
      if (!ids.length) {
        setConvs([])
        setOthers({})
        return
      }
      const { data: allMem, error: allMembersError } = await supabase.from('conversation_members').select('conversation_id, user_id').in('conversation_id', ids)
      if (allMembersError) throw allMembersError
      const otherIds = [...new Set((allMem || []).filter(m => m.user_id !== session.user.id).map(m => m.user_id))]
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').in('id', otherIds)
      if (profilesError) throw profilesError
      const profMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      const { data: lastMsgs, error: messagesError } = await supabase.from('messages').select('conversation_id, body, created_at').in('conversation_id', ids).order('created_at', { ascending: false })
      if (messagesError) throw messagesError
      const lastByConv = {}
      for (const m of lastMsgs || []) if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m
      const otherByConv = {}
      for (const m of allMem || []) if (m.user_id !== session.user.id) otherByConv[m.conversation_id] = profMap[m.user_id]
      const list = ids
        .map(id => ({ id, other: otherByConv[id], last: lastByConv[id] }))
        .filter(c => c.other)
        .sort((a, b) => new Date(b.last?.created_at || 0) - new Date(a.last?.created_at || 0))
      setOthers(Object.fromEntries(list.map(c => [c.id, c.other])))
      setConvs(list)
      if (!active && list.length) setActive(list[0].id)
    } catch (loadError) {
      setError(getUserFacingError(loadError, 'We couldn’t load your conversations right now. Please try again.'))
    }
  }

  async function loadMsgs() {
    if (isDemoMode) {
      setMsgs(demo.messages.filter((message) => message.conversation_id === active))
      return
    }
    try {
      const { data, error: messagesError } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(id, display_name, avatar_url)')
        .eq('conversation_id', active)
        .order('created_at', { ascending: true })
      if (messagesError) throw messagesError
      setMsgs(data || [])
      setError('')
    } catch (messagesError) {
      setError(getUserFacingError(messagesError, 'We couldn’t load these messages right now. Please try again.'))
    }
  }

  async function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body || !session || !active || sending) return
    setError('')
    setSending(true)
    // Add a temporary message to both the open chat and its conversation preview.
    if (isDemoMode) {
      const message = {
        id: 'demo-message-' + Date.now(),
        conversation_id: active,
        sender_id: session.user.id,
        body: text.trim(),
        created_at: new Date().toISOString(),
        profiles: profile,
      }
      demo.setMessages((current) => [...current, message])
      demo.setConversations((current) => current.map((conversation) => conversation.id === active
        ? { ...conversation, last: message }
        : conversation))
      setMsgs((current) => [...current, message])
      setConvs((current) => current.map((conversation) => conversation.id === active
        ? { ...conversation, last: message }
        : conversation))
      setText('')
      setSending(false)
      return
    }
    try {
      const { data: message, error } = await supabase.from('messages').insert({
        conversation_id: active,
        sender_id: session.user.id,
        body,
      }).select('*, profiles:sender_id(id, display_name, avatar_url)').single()
      if (error) throw error
      if (message) {
        setMsgs((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
        setConvs((current) => current.map((conversation) => conversation.id === active
          ? { ...conversation, last: message }
          : conversation))
      }
      setText('')
      await loadConvs()
    } catch (error) {
      setError(error?.code === '42501'
        ? 'This account or conversation is not currently allowed to send messages. Older chats may need a membership review before access can be restored.'
        : getUserFacingError(error, 'We couldn’t send your message right now. Please try again.'))
    } finally {
      setSending(false)
    }
  }

  if (!session) {
    return (
      <div className="auth-prompt">
        <h2>Messages</h2>
        <p>Sign in to start conversations with other creatives.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={promptSignIn}>Sign in</button>
      </div>
    )
  }

  return (
    <div className="messages-wrap">
      {/* The left column selects a conversation; the right column shows its messages. */}
      <aside className="conv-list">
        {convs.length === 0 && !error && (
          <div className="panel-empty">
            No conversations available.<br />Find people on the People page and say hello. Older chats may need a membership review before access can be restored.
          </div>
        )}
        {convs.map(c => (
          <button key={c.id} type="button" className={'conv-item' + (active === c.id ? ' active' : '')} onClick={() => setActive(c.id)}>
            <Avatar profile={c.other} />
            <div style={{ minWidth: 0 }}>
              <div className="name">{c.other.display_name || 'Unknown'}</div>
              <div className="preview">{c.last ? c.last.body : 'Start the conversation'}</div>
            </div>
          </button>
        ))}
      </aside>

      <section className="thread-panel">
        {error && <p className="error-text" role="alert">{error}</p>}
        {active ? (
          <>
            <div className="thread-head">{others[active]?.display_name || 'Conversation'}</div>
            <div className="msgs">
              {msgs.map(m => (
                <div key={m.id} className={'msg' + (m.sender_id === session.user.id ? ' mine' : '')}>
                  {m.sender_id !== session.user.id && (
                    <div className="meta">{m.profiles?.display_name || ''} · {timeAgo(m.created_at)}</div>
                  )}
                  {m.body}
                  {m.sender_id !== session.user.id && (
                    <ReportButton
                      targetType="message"
                      targetId={m.id}
                      ownerId={m.sender_id}
                      promptSignIn={promptSignIn}
                    />
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form className="msg-form" onSubmit={send}>
              <input
                className="input"
                placeholder={'Message ' + (others[active]?.display_name || '') + '…'}
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <button className="btn" type="submit" disabled={!text.trim() || sending}>{sending ? 'Sending…' : 'Send'}</button>
            </form>
          </>
        ) : (
          <div className="panel-empty" style={{ margin: 'auto' }}>Select a conversation to view messages.</div>
        )}
      </section>
    </div>
  )
}
