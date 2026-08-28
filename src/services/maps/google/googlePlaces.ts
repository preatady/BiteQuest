import { PlaceProvider, NearbySearchOptions, UnifiedPlace } from '../types';

export class GooglePlacesProvider implements PlaceProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }

  async searchNearby(options: NearbySearchOptions): Promise<UnifiedPlace[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.primaryType',
        },
        body: JSON.stringify({
          includedTypes: ['restaurant', 'cafe', 'bakery', 'meal_takeaway'],
          maxResultCount: options.limit || 10,
          locationRestriction: {
            circle: {
              center: { latitude: options.latitude, longitude: options.longitude },
              radius: options.radiusMeters || 1200.0,
            },
          },
        }),
      });

      if (!response.ok) return [];
      const data = await response.json();
      if (!data.places) return [];

      return data.places.map((p: any) => ({
        id: `google_${p.id}`,
        providerId: p.id,
        name: p.displayName?.text || 'Quán ăn',
        category: 'street_food',
        categoryLabel: 'Ẩm thực đường phố',
        address: p.formattedAddress || 'Hà Nội',
        district: 'Cầu Giấy',
        latitude: p.location?.latitude || options.latitude,
        longitude: p.location?.longitude || options.longitude,
        rating: p.rating,
        reviewCount: p.userRatingCount,
      }));
    } catch (e) {
      console.warn('Google Places API call failed:', e);
      return [];
    }
  }
}
