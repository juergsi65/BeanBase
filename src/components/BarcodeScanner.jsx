import { useEffect, useRef, useState } from 'react'
import { normalizeBarcode, isValidGtin } from '../lib/barcode'
import { haptic } from '../lib/haptics'

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/** Kamera-Scanner für EAN/UPC. Nutzt den eingebauten BarcodeDetector, sonst ZXing (lazy geladen). */
export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null)
  const doneRef = useRef(false)
  const [status, setStatus] = useState('starting') // starting | scanning | error
  const [error, setError] = useState(null)
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState(null)

  const finish = (raw) => {
    const code = normalizeBarcode(raw)
    if (!code || doneRef.current) return
    doneRef.current = true
    haptic('success')
    onResult(code)
  }

  useEffect(() => {
    let stream
    let timer
    let controls
    let cancelled = false

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no-camera'), { name: 'NotSupportedError' })
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) return
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        setStatus('scanning')

        const supported = 'BarcodeDetector' in window ? await window.BarcodeDetector.getSupportedFormats().catch(() => []) : []
        const formats = NATIVE_FORMATS.filter((f) => supported.includes(f))
        if (formats.length) {
          const detector = new window.BarcodeDetector({ formats })
          timer = setInterval(async () => {
            if (doneRef.current || video.readyState < 2) return
            try {
              const codes = await detector.detect(video)
              if (codes[0]) finish(codes[0].rawValue)
            } catch {
              /* einzelner Frame fehlgeschlagen */
            }
          }, 150)
        } else {
          const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library'),
          ])
          if (cancelled) return
          const hints = new Map([
            [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
            [DecodeHintType.TRY_HARDER, true],
          ])
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
          controls = await reader.decodeFromStream(stream, video, (result) => {
            if (result) finish(result.getText())
          })
        }
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setError(
          e.name === 'NotAllowedError'
            ? 'Kamerazugriff verweigert. Erlaube die Kamera in den Browser-Einstellungen – oder gib die Nummer unten ein.'
            : e.name === 'NotFoundError' || e.name === 'NotSupportedError'
              ? 'Keine Kamera gefunden. Gib die Nummer unter dem Barcode unten ein.'
              : `Kamera konnte nicht gestartet werden (${e.message}). Gib die Nummer unten ein.`,
        )
      }
    }
    start()
    return () => {
      cancelled = true
      clearInterval(timer)
      controls?.stop()
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bewusst kein <form>: der Scanner liegt oft innerhalb des Bohnen-Formulars (verschachtelte Formulare
  // würden beim Bestätigen auch das äußere Formular absenden).
  const submitManual = () => {
    const code = normalizeBarcode(manual)
    if (!code) return setManualError('Bitte 8, 12 oder 13 Ziffern eingeben.')
    if (!isValidGtin(code)) return setManualError('Prüfziffer passt nicht – bitte Nummer kontrollieren.')
    finish(code)
  }

  return (
    <div className="scanner" role="dialog" aria-label="Barcode scannen">
      <div className="scanner-top">
        <strong>▦ Barcode scannen</strong>
        <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      <div className="scanner-view">
        <video ref={videoRef} playsInline muted />
        {status !== 'error' && <div className="scanner-frame" />}
        <p className="scanner-hint">
          {status === 'starting' ? 'Kamera wird gestartet …' : status === 'scanning' ? 'Barcode der Tüte in den Rahmen halten' : error}
        </p>
      </div>
      <div className="scanner-manual">
        <input
          inputMode="numeric"
          placeholder="oder Nummer eintippen"
          value={manual}
          onChange={(e) => {
            setManual(e.target.value)
            setManualError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitManual()
            }
          }}
          aria-label="Barcode-Nummer"
        />
        <button type="button" className="btn primary" onClick={submitManual}>
          OK
        </button>
      </div>
      {manualError && <p className="scanner-error">{manualError}</p>}
    </div>
  )
}
