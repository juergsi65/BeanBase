export default function Avatar({ profile, size = 40 }) {
  const name = profile?.display_name || profile?.username || '?'
  return profile?.avatar_url ? (
    <img className="avatar" src={profile.avatar_url} alt="" width={size} height={size} style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {name.replace(/^barista_/, '').charAt(0).toUpperCase()}
    </span>
  )
}
