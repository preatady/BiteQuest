import { RouteProvider, RouteOptions, RouteResult } from '../types';

export class GoogleRoutesProvider implements RouteProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }

  async computeRoute(options: RouteOptions): Promise<RouteResult | null> {
    if (!this.apiKey) {
      return this.computeStraightLineFallback(options);
    }

    try {
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: options.origin.latitude, longitude: options.origin.longitude } } },
          destination: { location: { latLng: { latitude: options.destination.latitude, longitude: options.destination.longitude } } },
          travelMode: options.mode === 'walk' ? 'WALK' : 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
        }),
      });

      if (!response.ok) {
        return this.computeStraightLineFallback(options);
      }
      const data = await response.json();
      const route = data.routes?.[0];
      if (!route) {
        return this.computeStraightLineFallback(options);
      }

      const durationSeconds = parseInt(route.duration.replace('s', ''), 10) || 600;
      const durationMins = Math.round(durationSeconds / 60);
      const dist = route.distanceMeters || 1000;

      return {
        distanceMeters: dist,
        durationMinutes: durationMins,
        formattedDuration: `${durationMins} phút`,
        formattedDistance: dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`,
        hasLiveTraffic: true,
      };
    } catch (e) {
      console.warn('Google Routes API call failed, falling back to straight-line route:', e);
      return this.computeStraightLineFallback(options);
    }
  }

  private computeStraightLineFallback(options: RouteOptions): RouteResult {
    const R = 6371e3;
    const φ1 = (options.origin.latitude * Math.PI) / 180;
    const φ2 = (options.destination.latitude * Math.PI) / 180;
    const Δφ = ((options.destination.latitude - options.origin.latitude) * Math.PI) / 180;
    const Δλ = ((options.destination.longitude - options.origin.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = Math.round(R * c);

    const speedMps = options.mode === 'walk' ? 1.2 : 6.5;
    const durationMins = Math.max(1, Math.round(dist / speedMps / 60));

    return {
      distanceMeters: dist,
      durationMinutes: durationMins,
      formattedDuration: `${durationMins} phút`,
      formattedDistance: dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`,
      hasLiveTraffic: false,
    };
  }
}
