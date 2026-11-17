// Fotos & Videos für Bezüge und Setup (Bucket brew-media, öffentlich lesbar über zufällige URL)
import { supabase } from './supabase'
import type { MediaType } from '../types'

export interface PreparedMedia {
  kind: MediaType
  blob: Blob
  previewUrl: string
  dataUrl?: string
  contentType: string
  ext: string
}
import { resizeImage } from './images'
import { loadSettings } from './settings'

const BUCKET = 'brew-media'
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const MAX_VIDEO_SECONDS = 60
export const mediaAvailable = !!supabase

function videoDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src)
      resolve(v.duration)
    }
    v.onerror = () => resolve(null)
    v.src = URL.createObjectURL(file)
  })
}

/**
 * Bereitet eine Datei vor (Bild verkleinern / Video prüfen) – noch ohne Upload.
 * → { kind: 'image'|'video', blob, previewUrl, contentType, ext }
 */
export async function prepareMedia(file: File): Promise<PreparedMedia> {
  if (file.type.startsWith('video/')) {
    if (!supabase) throw new Error('Videos können nur mit Konto (Supabase) gespeichert werden.')
    if (!(await loadSettings()).video_uploads) throw new Error('Video-Uploads sind in der Beta noch gesperrt – bitte ein Foto verwenden.')
    if (file.size > MAX_VIDEO_BYTES) throw new Error(`Video ist zu groß (max. ${MAX_VIDEO_BYTES / 1024 / 1024} MB). Kürze es in der Fotos-App.`)
    const d = await videoDuration(file)
    if (d && d > MAX_VIDEO_SECONDS + 1) throw new Error(`Video ist ${Math.round(d)} s lang – bitte max. ${MAX_VIDEO_SECONDS} s.`)
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
    return { kind: 'video', blob: file, previewUrl: URL.createObjectURL(file), contentType: file.type, ext }
  }
  if (!file.type.startsWith('image/')) throw new Error('Bitte ein Foto oder Video auswählen.')
  const { blob, dataUrl } = await resizeImage(file)
  return { kind: 'image', blob, previewUrl: dataUrl, dataUrl, contentType: 'image/jpeg', ext: 'jpg' }
}

/** Lädt vorbereitete Medien hoch → { url, type }. Demo-Modus: Bilder als Data-URL. */
export async function uploadMedia(prepared: PreparedMedia): Promise<{ url: string; type: MediaType }> {
  if (!supabase) return { url: prepared.dataUrl ?? prepared.previewUrl, type: 'image' }
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Nicht angemeldet.')
  const path = `${data.session.user.id}/${crypto.randomUUID()}.${prepared.ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, prepared.blob, { contentType: prepared.contentType })
  if (error) throw error
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, type: prepared.kind }
}

export async function deleteMedia(url: string | null | undefined) {
  if (!supabase || !url || url.startsWith('data:')) return
  const path = url.split(`/${BUCKET}/`)[1]
  if (path) await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)])
}
