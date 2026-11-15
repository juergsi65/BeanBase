// Bohnen-Fotos: verkleinern, speichern (Supabase Storage oder Data-URL), KI-Analyse
import { supabase } from './supabase'

const BUCKET = 'bean-images'
export const canAnalyze = !!supabase

/** Verkleinert ein Foto auf max. `max` px Kantenlänge als JPEG (spart Upload & Speicher). */
export async function resizeImage(file, max = supabase ? 1600 : 640, quality = supabase ? 0.85 : 0.7) {
  const bitmap = await createImageBitmap(file) // berücksichtigt EXIF-Drehung
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
  return { blob, dataUrl }
}

/** Speichert das Foto und gibt die URL zurück. Demo-Modus: Data-URL (localStorage). */
export async function storeBeanImage({ blob, dataUrl }) {
  if (!supabase) return dataUrl
  const { data } = await supabase.auth.getUser()
  const path = `${data.user.id}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function deleteBeanImage(url) {
  if (!supabase || !url || url.startsWith('data:')) return
  const path = url.split(`/${BUCKET}/`)[1]
  if (path) await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)])
}

/** Etikett per Edge Function (Gemini) auslesen → { name, roaster, origin, ... } */
export async function analyzeLabel(dataUrl) {
  const [meta, image] = dataUrl.split(',')
  const mimeType = meta.match(/data:(.*?);/)?.[1] ?? 'image/jpeg'
  const { data, error } = await supabase.functions.invoke('analyze-bean-label', { body: { image, mimeType } })
  if (error) {
    let detail = error.message
    try {
      detail = (await error.context.json()).error ?? detail
    } catch {
      /* keine JSON-Antwort */
    }
    throw new Error(`KI-Erkennung fehlgeschlagen: ${detail}`)
  }
  return data
}
