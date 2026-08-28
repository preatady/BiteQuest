import { RouteProvider, RouteOptions, RouteResult } from '../types';

export class GoogleRoutesProvider implements RouteProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }

  async computeRoute(options: RouteOptions): Promise<RouteResult | null> {
    if (!this.apiKey) return null;

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

      if (!response.ok) return null;
      const data = await response.json();
      const route = data.routes?.[0];
      if (!route) return null;

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
      console.warn('Google Routes API call failed:', e);
      return null;
    }
  }
}
