import { useMemo } from "react"

export type GeoFix = { lat: number; lng: number; accuracyM: number }
export type GeoResult = ({ ok: true } & GeoFix) | { ok: false; error: string }

const TIMEOUT_MS = 10_000

export function useGeolocation(): {
  supported: boolean
  request: () => Promise<GeoResult>
  /**
   * Start a continuous-position subscription. The callback fires once when
   * the first fix arrives and then on every subsequent update from the
   * browser (movement, WiFi/GPS refresh). Returns an unsubscribe function.
   */
  watch: (onUpdate: (result: GeoResult) => void) => () => void
} {
  const supported = useMemo(
    () => typeof navigator !== "undefined" && "geolocation" in navigator,
    []
  )

  function request(): Promise<GeoResult> {
    if (!supported) {
      return Promise.resolve({ ok: false, error: "unsupported" })
    }
    return new Promise<GeoResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            ok: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
          }),
        (err) => resolve({ ok: false, error: reasonFor(err) }),
        { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 0 }
      )
    })
  }

  function watch(onUpdate: (result: GeoResult) => void): () => void {
    if (!supported) {
      onUpdate({ ok: false, error: "unsupported" })
      return () => {}
    }
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        onUpdate({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        }),
      (err) => onUpdate({ ok: false, error: reasonFor(err) }),
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 0 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }

  return { supported, request, watch }
}

function reasonFor(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "denied"
    case err.POSITION_UNAVAILABLE:
      return "unavailable"
    case err.TIMEOUT:
      return "timeout"
    default:
      return "error"
  }
}
