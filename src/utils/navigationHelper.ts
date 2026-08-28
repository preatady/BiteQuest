/**
 * Helper to build reliable Google Maps navigation URLs
 * Handles coordinate pinning, place ID binding, and clean search queries.
 */
export function buildGoogleMapsDirectionsUrl(params: {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
}): string {
  const { name, address, latitude, longitude, googlePlaceId } = params;

  // Clean name by removing branch suffixes like " - Cầu Giấy" or " - Ba Đình" if followed by full address to avoid over-constrained Google searches
  const cleanName = (name || '').trim();
  
  // Clean address: remove internal floor prefixes like "Tầng 1 ", "Tầng 2 " which confuse Google Maps geocoding
  let cleanAddress = (address || '').replace(/^Tầng\s+\d+\s+/i, '').trim();

  // Primary: If we have valid coordinates, use them for pinpoint accuracy on Google Maps
  if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
    // If we have a Google Place ID, include destination_place_id for exact entity matching
    if (googlePlaceId && googlePlaceId.startsWith('ChIJ')) {
      return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(googlePlaceId)}`;
    }
    // With coordinates, Google Maps will navigate directly to the exact pin
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }

  // Fallback: Query by name and clean address
  const destinationQuery = [cleanName, cleanAddress].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery || 'Hà Nội')}`;
}
