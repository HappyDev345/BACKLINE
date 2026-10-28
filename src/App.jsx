// This file connects each website address to the page shown there and keeps
// shared pieces, such as the sign-in window, available across the site.
import { useState } from 'react'
import { Routes, Route, useLocation, Link } from 'react-router-dom'
import NavBar from './components/NavBar'
import AuthModal from './components/AuthModal'
import LandingPage from './pages/LandingPage'
import AboutPage from './pages/AboutPage'
import FeedPage from './pages/FeedPage'
import DiscoverPage from './pages/DiscoverPage'
import PeoplePage from './pages/PeoplePage'
import ProfilePage from './pages/ProfilePage'
import MessagesPage from './pages/MessagesPage'
import ForumPage from './pages/ForumPage'
import NotificationsPage from './pages/NotificationsPage'
import AccountSettingsPage from './pages/AccountSettingsPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import StaffPage from './pages/StaffPage'
import MyReportsPage from './pages/MyReportsPage'
import { isDemoMode } from './lib/supabase'

export default function App() {
  // The same sign-in window can be opened from any page using this helper.
  const [authOpen, setAuthOpen] = useState(false)
  const promptSignIn = () => setAuthOpen(true)
  const { pathname } = useLocation()
  const isLandingPage = pathname === '/'

  return (
    <>
      {/* This label reminds visitors that preview edits are temporary. */}
      {isDemoMode && <div className="demo-banner" role="status">Preview mode · sample content only; changes reset when you refresh.</div>}
      <NavBar onSignIn={promptSignIn} />
      {/* Each Route pairs a web address with the page component that handles it. */}
      <Routes>
        <Route path="/" element={<LandingPage onSignIn={promptSignIn} />} />
        <Route path="/about" element={<AboutPage onSignIn={promptSignIn} />} />
        <Route path="/feed" element={<FeedPage promptSignIn={promptSignIn} />} />
        <Route path="/discover" element={<DiscoverPage promptSignIn={promptSignIn} />} />
        <Route path="/people" element={<PeoplePage promptSignIn={promptSignIn} />} />
        <Route path="/profile" element={<ProfilePage promptSignIn={promptSignIn} />} />
        <Route path="/profile/:id" element={<ProfilePage promptSignIn={promptSignIn} />} />
        <Route path="/messages" element={<MessagesPage promptSignIn={promptSignIn} />} />
        <Route path="/forum" element={<ForumPage promptSignIn={promptSignIn} />} />
        <Route path="/notifications" element={<NotificationsPage promptSignIn={promptSignIn} />} />
        <Route path="/settings" element={<AccountSettingsPage promptSignIn={promptSignIn} />} />
        <Route path="/my-reports" element={<MyReportsPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Unknown addresses get a friendly message instead of a blank screen. */}
        <Route path="*" element={<div className="auth-prompt"><h2>That page is off the call sheet</h2><p>We couldn’t find that page.</p><Link className="btn" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }} to="/">Back to BACKLINE</Link></div>} />
      </Routes>
      {/* Keep one sign-in window mounted here so every page opens the same one. */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      {!isLandingPage && <footer>BACKLINE · Connecting the people who make productions happen.</footer>}
    </>
  )
}
