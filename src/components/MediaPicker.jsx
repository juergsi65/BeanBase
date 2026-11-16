import { useRef, useState } from 'react'
import { prepareMedia } from '../lib/media'

/** Anzeige eines gespeicherten Fotos/Videos */
export function MediaView({ url, type, className = '' }) {
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
export default function MediaPicker({ value, pending, onChange, allowVideo = true, label = 'Foto' }) {
  const camRef = useRef(null)
  const fileRef = useRef(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(null)
    setBusy(true)
    try {
      onChange({ pending: await prepareMedia(file), removed: false })
    } catch (e2) {
      setErr(e2.message)
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
        <button type="button" className="btn ghost" onClick={() => camRef.current.click()} disabled={busy}>
          📷 {allowVideo ? 'Foto / Video' : 'Foto'}
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current.click()} disabled={busy}>
          🖼 Aus Galerie
        </button>
      </div>
      <input ref={camRef} type="file" accept={accept} capture="environment" hidden onChange={onFile} />
      <input ref={fileRef} type="file" accept={accept} hidden onChange={onFile} data-testid="media-upload" />
      {busy && <p className="muted small">Wird vorbereitet …</p>}
      {allowVideo && !shown && <p className="muted small">Videos bis 60 s / 50 MB – z. B. den Durchlauf des Shots.</p>}
      {err && <p className="scanner-error">{err}</p>}
    </div>
  )
}
