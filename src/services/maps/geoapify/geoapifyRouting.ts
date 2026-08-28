import { RouteProvider, RouteOptions, RouteResult } from '../types';
import { GeoapifyRoutingResponseSchema } from './geoapifyTypes';
import { getDistance } from 'geolib';

export class GeoapifyRouteProvider implements RouteProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    const rawKey =
      apiKey ??
      (typeof process !== 'undefined'
        ? process.env?.GEOAPIFY_SERVER_KEY || process.env?.GEOAPIFY_API_KEY
        : '') ??
      '';
    this.apiKey =
      typeof rawKey === 'string' &&
      rawKey.trim() !== '' &&
      rawKey !== 'undefined' &&
      rawKey !== 'null'
        ? rawKey.trim()
        : '';
  }

  async computeRoute(options: RouteOptions): Promise<RouteResult | null> {
    const { origin, destination, mode = 'drive' } = options;
    const waypoints = `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`;

    // Direct distance using geolib
    const straightDist = getDistance(
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude }
    );

    if (!this.apiKey) {
      return this.getFallbackRoute(straightDist, mode);
    }

    try {
      const modeParam = mode === 'walk' ? 'walk' : 'drive';
      const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=${modeParam}&apiKey=${this.apiKey}`;

      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          this.apiKey = '';
        }
        return this.getFallbackRoute(straightDist, mode);
      }

      const json = await res.json();
      const parsed = GeoapifyRoutingResponseSchema.safeParse(json);

      if (parsed.success && parsed.data.features && parsed.data.features.length > 0) {
        const feat = parsed.data.features[0];
        const dist = feat.properties.distance;
        const timeSec = feat.properties.time;
        const durationMins = Math.max(1, Math.round(timeSec / 60));

        return {
          distanceMeters: dist,
          durationMinutes: durationMins,
          formattedDuration: `${durationMins} phút`,
          formattedDistance: dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`,
          geometry: feat.geometry,
          hasLiveTraffic: false,
          isApproximate: false,
          provenance: 'LIVE_PROVIDER',
        };
      }
    } catch {
      // Graceful fallback to physical estimation
    }

    return this.getFallbackRoute(straightDist, mode);
  }

  private getFallbackRoute(straightDist: number, mode?: 'drive' | 'walk' | 'bicycle'): RouteResult {
    // Direct physical calculation (urban road factor ~ 1.35)
    const estimatedRoadDist = Math.round(straightDist * 1.35);
    // Avg urban city driving speed ~ 22 km/h (366 m/min), walking ~ 4.5 km/h (75 m/min), bicycle ~ 14 km/h (230 m/min)
    let speedMPerMin = 360;
    if (mode === 'walk') speedMPerMin = 75;
    else if (mode === 'bicycle') speedMPerMin = 230;

    const durationMins = Math.max(1, Math.round(estimatedRoadDist / speedMPerMin));

    return {
      distanceMeters: estimatedRoadDist,
      durationMinutes: durationMins,
      formattedDuration: `${durationMins} phút`,
      formattedDistance:
        estimatedRoadDist >= 1000 ? `${(estimatedRoadDist / 1000).toFixed(1)} km` : `${estimatedRoadDist} m`,
      hasLiveTraffic: false,
      isApproximate: true,
      provenance: 'APPROXIMATE_FALLBACK',
    };
  }
}
