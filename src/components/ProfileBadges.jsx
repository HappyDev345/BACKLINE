export default function ProfileBadges({ profile }) {
  const roles = (profile?.staff_roles || []).map((item) => typeof item === 'string' ? item : item.role)
  const badges = (profile?.profile_badges || []).map((item) => typeof item === 'string' ? item : item.badge)
  if (!roles.length && !badges.length) return null
  return (
    <span className="profile-badges">
      {roles.includes('admin') && <span className="badge badge-admin">Admin</span>}
      {roles.includes('feed_moderator') && <span className="badge badge-staff">Feed moderator</span>}
      {roles.includes('project_moderator') && <span className="badge badge-staff">Project moderator</span>}
      {badges.includes('verified') && <span className="badge badge-verified">Verified</span>}
    </span>
  )
}
