import type { Profile } from '../types'

export default function Avatar({
  profile,
  size = 40,
}: {
  profile: Partial<Pick<Profile, 'display_name' | 'username' | 'avatar_url'>> | null | undefined
  size?: number
}) {
  const name = profile?.display_name || profile?.username || '?'
  return profile?.avatar_url ? (
    <span className="avatar shrink-0">
      <img className="rounded-full border border-base-300" src={profile.avatar_url} alt="" width={size} height={size} style={{ width: size, height: size }} loading="lazy" />
    </span>
  ) : (
    <span className="avatar avatar-placeholder shrink-0" aria-hidden>
      <span className="avatar-fallback flex items-center justify-center rounded-full font-extrabold leading-none" style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {name.replace(/^barista_/, '').charAt(0).toUpperCase()}
      </span>
    </span>
  )
}
