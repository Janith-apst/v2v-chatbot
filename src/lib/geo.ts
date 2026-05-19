import type { Venue } from "@/data/maptivate"

export type LatLng = { lat: number; lng: number }

export type RankedVenue = Venue & { distanceKm: number }

const EARTH_RADIUS_KM = 6371

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function nearestVenues(
  origin: LatLng,
  venues: Venue[],
  n: number
): RankedVenue[] {
  return venues
    .map((v) => ({ ...v, distanceKm: haversineKm(origin, { lat: v.lat, lng: v.lng }) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, n)
}

/**
 * Approximate the user's "area" by picking the LGA whose venue centroid is
 * closest. Cheap stand-in for a real reverse-geocode — good enough to let
 * the model say "you're roughly in the Yarra area" without a network call.
 */
export function approximateLga(origin: LatLng, venues: Venue[]): string | null {
  if (venues.length === 0) return null
  const byLga = new Map<string, { lat: number; lng: number; n: number }>()
  for (const v of venues) {
    const c = byLga.get(v.lga) ?? { lat: 0, lng: 0, n: 0 }
    c.lat += v.lat
    c.lng += v.lng
    c.n += 1
    byLga.set(v.lga, c)
  }
  let best: { lga: string; dist: number } | null = null
  for (const [lga, c] of byLga) {
    const centroid = { lat: c.lat / c.n, lng: c.lng / c.n }
    const d = haversineKm(origin, centroid)
    if (!best || d < best.dist) best = { lga, dist: d }
  }
  return best ? best.lga : null
}
