import { RouteProvider, RouteOptions, RouteResult } from './types';
import { GeoapifyRouteProvider } from './geoapify/geoapifyRouting';

export const routeFeatureFlags = {
  // Feature flag explicitly false when no reliable live/historical traffic provider is active
  bestTimeToGo: false,
};

class RouteService {
  private activeProvider: RouteProvider;

  constructor() {
    const geoapifyKey =
      (typeof process !== 'undefined' && (process.env?.GEOAPIFY_SERVER_KEY || process.env?.GEOAPIFY_API_KEY)) || '';
    this.activeProvider = new GeoapifyRouteProvider(geoapifyKey);
  }

  setProvider(provider: RouteProvider) {
    this.activeProvider = provider;
  }

  async calculateRoute(options: RouteOptions): Promise<RouteResult | null> {
    return this.activeProvider.computeRoute(options);
  }
}

export const routeService = new RouteService();
