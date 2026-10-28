// Shares the current account and sign-in actions with every page.
// When Supabase settings are absent, accounts are temporary preview accounts.
import { createContext, useContext, useEffect, useState } from 'react'
import { isDemoMode, supabase } from '../lib/supabase'
import { demoProfiles } from '../lib/demoData'
import { useDemoData } from './DemoContext'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const demo = useDemoData()
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [staffRoles, setStaffRoles] = useState([])
  const [staffRoleError, setStaffRoleError] = useState('')
  const [loading, setLoading] = useState(true)

  async function fetchProfile(id) {
    // Preview profiles come from the sample data held in the browser.
    if (isDemoMode) {
      setProfile(demo.profiles.find((person) => person.id === id) || null)
      setStaffRoles([])
      setStaffRoleError('')
      setLoading(false)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    const { data: roles, error } = await supabase.from('staff_roles').select('role').eq('user_id', id)
    setProfile(data)
    if (error) {
      setStaffRoles([])
      setStaffRoleError('Staff permissions could not be loaded. Please contact an administrator.')
    } else {
      setStaffRoles((roles || []).map((row) => row.role))
      setStaffRoleError('')
    }
    setLoading(false)
  }

  useEffect(() => {
    // A preview has no saved login to restore, so it starts signed out.
    if (isDemoMode) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) fetchProfile(data.session.user.id)
      else setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) fetchProfile(s.user.id)
      else { setProfile(null); setStaffRoles([]); setStaffRoleError(''); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signUp(email, password, displayName, username) {
    // A preview account is only a local example; the connected path creates it in Supabase.
    if (isDemoMode) {
      const demoSession = { user: { id: 'demo-user', email } }
      const person = {
        ...(demo.profiles.find((profile) => profile.id === 'demo-user') || demoProfiles[0]),
        display_name: displayName || demoProfiles[0].display_name,
        username: username || demoProfiles[0].username,
      }
      setSession(demoSession)
      setStaffRoles([])
      demo.setProfiles((current) => current.map((profile) => profile.id === 'demo-user' ? person : profile))
      setProfile(person)
      return
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, username } },
    })
    if (error) throw error
  }

  async function signIn(email, password) {
    if (isDemoMode) {
      setSession({ user: { id: 'demo-user', email } })
      setStaffRoles([])
      setProfile(demo.profiles.find((person) => person.id === 'demo-user') || demoProfiles[0])
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  function signInAsDemoUser() {
    if (!isDemoMode) throw new Error('Sample user sign-in is only available in preview mode.')
    const person = demo.profiles.find((profile) => profile.id === 'demo-user') || demoProfiles[0]
    setSession({ user: { id: person.id } })
    setStaffRoles([])
    setProfile(person)
  }

  async function signOut(options) {
    if (isDemoMode) {
      setSession(null)
      setProfile(null)
      setStaffRoles([])
      return
    }
    const { error } = await supabase.auth.signOut(options)
    if (error) throw error
  }

  async function refreshProfile() {
    if (session && !isDemoMode) await fetchProfile(session.user.id)
  }

  function updateDemoProfile(updates) {
    if (isDemoMode) setProfile((current) => ({ ...current, ...updates }))
  }

  return (
    <AuthCtx.Provider value={{ session, profile, staffRoles, staffRoleError, loading, signUp, signIn, signInAsDemoUser, signOut, refreshProfile, updateDemoProfile }}>
      {children}
    </AuthCtx.Provider>
  )
}
