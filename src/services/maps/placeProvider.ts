import { PlaceProvider, NearbySearchOptions, UnifiedPlace } from './types';
import { GeoapifyPlaceProvider } from './geoapify/geoapifyPlaces';
import { venueRegistry } from './venueRegistryService';

export interface ProviderStatus {
  name: string;
  configured: boolean;
  type: 'PRIMARY' | 'COMMUNITY' | 'EXPERIMENTAL';
}

class PlaceService {
  private activeProvider: PlaceProvider;
  private providers: Map<string, PlaceProvider> = new Map();

  constructor() {
    const geoapifyKey =
      (typeof process !== 'undefined' && (process.env?.GEOAPIFY_SERVER_KEY || process.env?.GEOAPIFY_API_KEY)) || '';
    const geoapify = new GeoapifyPlaceProvider(geoapifyKey);
    this.activeProvider = geoapify;
    this.providers.set('geoapify', geoapify);

    // Wire primary provider into canonical venue registry
    venueRegistry.setPrimaryProvider(geoapify);
  }

  getActiveProvider(): PlaceProvider {
    return this.activeProvider;
  }

  setProvider(provider: PlaceProvider) {
    this.activeProvider = provider;
    if (provider.providerName) {
      this.providers.set(provider.providerName, provider);
    }
    venueRegistry.setPrimaryProvider(provider);
  }

  getProviderStatuses(): ProviderStatus[] {
    const isGeoConfigured =
      typeof this.activeProvider.isConfigured === 'function' ? this.activeProvider.isConfigured() : true;

    return [
      {
        name: 'Geoapify Places API',
        configured: isGeoConfigured,
        type: 'PRIMARY',
      },
      {
        name: 'BiteQuest Community Registry',
        configured: true,
        type: 'COMMUNITY',
      },
      {
        name: 'Google Places API',
        configured: false,
        type: 'EXPERIMENTAL',
      },
    ];
  }

  async getNearbyFoodPlaces(options: NearbySearchOptions): Promise<UnifiedPlace[]> {
    return this.activeProvider.searchNearby(options);
  }
}

export const placeService = new PlaceService();
