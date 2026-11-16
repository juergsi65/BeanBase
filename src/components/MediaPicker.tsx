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
    <div className="media-picker">
      {shown ? (
        <div className="photo">
          <MediaView url={shown.url} type={shown.type} />
          <button type="button" className="btn ghost sm photo-remove" onClick={() => onChange({ pending: null, removed: true })} aria-label={`${label} entfernen`}>
            ✕
          </button>
        </div>
      ) : null}
      <div className="grid2">
        <button type="button" className="btn ghost" onClick={() => camRef.current?.click()} disabled={busy}>
          📷 {allowVideo ? 'Foto / Video' : 'Foto'}
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
          🖼 Aus Galerie
        </button>
      </div>
      <input ref={camRef} type="file" accept={accept} capture="environment" hidden onChange={onFile} />
      <input ref={fileRef} type="file" accept={accept} hidden onChange={onFile} data-testid="media-upload" />
      {busy && <p className="muted small">Wird vorbereitet …</p>}
      {allowVideo && !shown && <p className="muted small">Videos bis 60 s / 50 MB – z. B. den Durchlauf des Shots.</p>}
      {wantsVideo && !allowVideo && !isLocalMode && !shown && (
        <p className="tba-note">
          <span className="tba">Video · bald</span> Video-Uploads sind in der Beta noch gesperrt.
        </p>
      )}
      {err && <p className="scanner-error">{err}</p>}
    </div>
  )
}
