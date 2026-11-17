import { Camera, Image, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { errMsg } from '../lib/errors'
import { prepareMedia, type PreparedMedia } from '../lib/media'
import type { MediaType } from '../types'
import { useSettings } from '../lib/settings'
import { isLocalMode } from '../lib/supabase'

/** Anzeige eines gespeicherten Fotos/Videos */
export function MediaView({ url, type, className = '' }: { url: string | null | undefined; type?: MediaType | null; className?: string }) {
  if (!url) return null
  return type === 'video' ? (
    // oxlint-disable-next-line jsx-a11y/media-has-caption -- Nutzer-Videos (Brew-Clips) haben keine Untertitel
    <video className={`media ${className}`} src={url} controls playsInline preload="metadata" />
  ) : (
    <img className={`media ${className}`} src={url} alt="" loading="lazy" />
  )
}

/**
 * Auswahl + Vorschau. value: { url, type } (gespeichert) · pending: vorbereitete Datei
 * onChange({ pending, removed })
 */
export interface MediaChange {
  pending: PreparedMedia | null
  removed: boolean
}

export default function MediaPicker({
  value,
  pending,
  onChange,
  allowVideo: wantsVideo = true,
  label = 'Foto',
}: {
  value?: { url: string | null; type?: MediaType | null } | null
  pending?: PreparedMedia | null
  onChange: (c: MediaChange) => void
  allowVideo?: boolean
  label?: string
}) {
  // Videos nur, wenn im Admin-Bereich freigeschaltet (Beta: gesperrt)
  const settings = useSettings()
  const allowVideo = wantsVideo && !isLocalMode && settings.video_uploads
  const camRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(null)
    setBusy(true)
    try {
      onChange({ pending: await prepareMedia(file), removed: false })
    } catch (e2) {
      setErr(errMsg(e2))
    } finally {
      setBusy(false)
    }
  }
  const shown = pending ? { url: pending.previewUrl, type: pending.kind } : value?.url ? value : null
  const accept = allowVideo ? 'image/*,video/*' : 'image/*'

  return (
    <div className="flex flex-col gap-2">
      {shown ? (
        <div className="photo">
          <MediaView url={shown.url} type={shown.type} />
          <button type="button" className="btn btn-ghost btn-sm absolute top-2 right-2 border-base-300 bg-page/75" onClick={() => onChange({ pending: null, removed: true })} aria-label={`${label} entfernen`}>
            <X size={18} aria-hidden />
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-ghost border-base-300" onClick={() => camRef.current?.click()} disabled={busy}>
          <Camera size={16} aria-hidden /> {allowVideo ? 'Foto / Video' : 'Foto'}
        </button>
        <button type="button" className="btn btn-ghost border-base-300" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Image size={16} aria-hidden /> Aus Galerie
        </button>
      </div>
      <input ref={camRef} type="file" accept={accept} capture="environment" hidden onChange={onFile} />
      <input ref={fileRef} type="file" accept={accept} hidden onChange={onFile} data-testid="media-upload" />
      {busy && <p className="text-muted text-sm">Wird vorbereitet …</p>}
      {allowVideo && !shown && <p className="text-muted text-sm">Videos bis 60 s / 50 MB – z. B. den Durchlauf des Shots.</p>}
      {wantsVideo && !allowVideo && !isLocalMode && !shown && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <span className="badge badge-dash badge-info badge-sm font-bold whitespace-nowrap">Video · bald</span> Video-Uploads sind in der Beta noch gesperrt.
        </p>
      )}
      {err && <p className="text-sm text-error">{err}</p>}
    </div>
  )
}
