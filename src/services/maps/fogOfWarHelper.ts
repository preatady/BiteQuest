/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Place, BiteCheckin } from '../../types';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  name?: string;
  isUser?: boolean;
}

/**
 * Creates a circle ring of [longitude, latitude] coordinates.
 * @param center [lng, lat]
 * @param radiusMeters Radius in meters
 * @param points Number of vertices (default 36)
 * @param counterClockwise If true, vertices are generated counter-clockwise (required for GeoJSON polygon holes)
 */
export function createCircleCoordinates(
  center: [number, number],
  radiusMeters: number,
  points: number = 36,
  counterClockwise: boolean = true
): [number, number][] {
  const [lng, lat] = center;
  const coords: [number, number][] = [];

  const latOffset = radiusMeters / 111320;
  const lngOffset = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

  const step = (Math.PI * 2) / points;

  for (let i = 0; i <= points; i++) {
    const angle = counterClockwise ? i * step : -i * step;
    const pointLng = lng + lngOffset * Math.cos(angle);
    const pointLat = lat + latOffset * Math.sin(angle);
    coords.push([Number(pointLng.toFixed(6)), Number(pointLat.toFixed(6))]);
  }

  return coords;
}

export interface FogGeoJSONParams {
  userLocation: { latitude: number; longitude: number } | null;
  visitedLocations: LocationPoint[];
  visionRadiusMeters?: number;
  visitedRadiusMeters?: number;
  radarBoostActive?: boolean;
}

/**
 * Generates the Fog of War GeoJSON Mask with cutout holes for:
 * 1. User's active field-of-vision beacon
 * 2. All permanently cleared visited food spots
 */
export function generateFogOfWarGeoJSON({
  userLocation,
  visitedLocations,
  visionRadiusMeters = 650,
  visitedRadiusMeters = 380,
  radarBoostActive = false,
}: FogGeoJSONParams): GeoJSON.FeatureCollection {
  // Global bounding outer ring (clockwise) covering the whole map
  const worldOuterRing: [number, number][] = [
    [-179.99, 85.0],
    [179.99, 85.0],
    [179.99, -85.0],
    [-179.99, -85.0],
    [-179.99, 85.0],
  ];

  const holeRings: [number, number][][] = [];
  const glowFeatures: GeoJSON.Feature[] = [];

  // 1. User Vision Hole (Large active radius around current player)
  if (userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number') {
    const effectiveRadius = radarBoostActive ? visionRadiusMeters * 1.6 : visionRadiusMeters;
    const userHole = createCircleCoordinates(
      [userLocation.longitude, userLocation.latitude],
      effectiveRadius,
      48,
      true
    );
    holeRings.push(userHole);

    // Glowing border for user active radar
    glowFeatures.push({
      type: 'Feature',
      properties: {
        type: 'user-beacon',
        radius: effectiveRadius,
      },
      geometry: {
        type: 'LineString',
        coordinates: userHole,
      },
    });
  }

  // 2. Visited Locations Holes (Permanently cleared zones)
  // Deduplicate nearby visited spots to keep GeoJSON geometry performant
  const deduplicatedVisited: LocationPoint[] = [];
  visitedLocations.forEach((loc) => {
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return;
    const isTooClose = deduplicatedVisited.some((d) => {
      const dLat = Math.abs(d.latitude - loc.latitude);
      const dLng = Math.abs(d.longitude - loc.longitude);
      return dLat < 0.0012 && dLng < 0.0012; // ~130m
    });
    if (!isTooClose) {
      deduplicatedVisited.push(loc);
    }
  });

  deduplicatedVisited.forEach((loc) => {
    const visitedHole = createCircleCoordinates(
      [loc.longitude, loc.latitude],
      visitedRadiusMeters,
      32,
      true
    );
    holeRings.push(visitedHole);

    glowFeatures.push({
      type: 'Feature',
      properties: {
        type: 'visited-beacon',
        name: loc.name || 'Quán đã khai phá',
      },
      geometry: {
        type: 'LineString',
        coordinates: visitedHole,
      },
    });
  });

  const fogPolygonFeature: GeoJSON.Feature = {
    type: 'Feature',
    properties: {
      type: 'fog-mask',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [worldOuterRing, ...holeRings],
    },
  };

  return {
    type: 'FeatureCollection',
    features: [fogPolygonFeature, ...glowFeatures],
  };
}

/**
 * Calculates Explorer RPG Stats for the Fog of War HUD
 */
export function calculateExplorerStats(
  totalVenues: number,
  visitedCount: number,
  districtName: string = 'Cầu Giấy'
) {
  // Base calculated discovery percentage
  const rawPercentage = totalVenues > 0 ? (visitedCount / totalVenues) * 100 : 0;
  // Dynamic minimum discovery (user starts with current vision area ~12%)
  const displayPercentage = Math.min(100, Math.max(12, Math.round(rawPercentage * 2.5 + 12)));

  let rank = 'Tân Binh Thám Hiểm';
  let badgeIcon = '🧭';
  let nextMilestone = 25;

  if (displayPercentage >= 80) {
    rank = 'Huyền Thoại Ẩm Thực';
    badgeIcon = '👑';
    nextMilestone = 100;
  } else if (displayPercentage >= 50) {
    rank = 'Bậc Thầy Khai Phá';
    badgeIcon = '⚔️';
    nextMilestone = 80;
  } else if (displayPercentage >= 25) {
    rank = 'Thợ Săn Ẩm Thực';
    badgeIcon = '🏹';
    nextMilestone = 50;
  }

  return {
    districtName,
    percentage: displayPercentage,
    unlockedZonesCount: Math.max(1, visitedCount + 1),
    totalZones: Math.max(20, Math.round(totalVenues * 0.4)),
    rank,
    badgeIcon,
    nextMilestone,
    xpMultiplier: 1.5,
  };
}
