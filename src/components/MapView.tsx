import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import MapGL, { Marker, NavigationControl, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Configure MapLibre Web Worker explicitly for Vite bundle so vector tiles (roads, buildings, water) render correctly
if (typeof (maplibregl as any).setWorkerUrl === 'function') {
  (maplibregl as any).setWorkerUrl(maplibreWorkerUrl);
}
import { getDistance } from 'geolib';
import { Place, BiteCheckin, DistrictPassport, User, BiteOpportunity } from '../types';
import { UnifiedPlace } from '../services/maps/types';
import {
  getMapLibreConfig,
  MapMode,
  CARTO_VOYAGER_STYLE,
  OPENFREEMAP_LIBERTY_STYLE,
  OSM_STANDARD_STYLE,
  ESRI_WORLD_IMAGERY_STYLE,
  getMapStyleForMode,
  isSatelliteConfigured,
  isEsriTokenConfigured,
} from '../services/maps/mapProvider';
import {
  normalizeCategory,
  getCategoryMetadata,
  CANONICAL_CATEGORIES,
  ExploreFilterCategory,
  computeDynamicFilterChips,
  computeQuickFilterChips,
  computeAllCategoryFilterCounts,
  matchVenueSearch,
  deduplicateVenuesList,
} from '../services/maps/categoryNormalizer';
import { registerAllCategoryIcons, setupMapIconLifecycle } from '../services/maps/mapIconHelper';
import { generateBiteOpportunities } from '../services/exploreEngine';
import { adaptBiteOpportunities } from '../services/todayIntelligenceAdapter';
import { OpportunityCarousel } from './OpportunityCarousel';
import { DiscoveryPeekSheet } from './DiscoveryPeekSheet';
import { EMPTY_USER, EMPTY_PASSPORT_CAU_GIAY } from '../data/seedData';
import { useExploreNearbyPlaces } from '../hooks/useExploreNearbyPlaces';
import { GoogleMapsSearchBar } from './GoogleMapsSearchBar';
import { CategoryFilterBar } from './CategoryFilterBar';
import { buildGoogleMapsDirectionsUrl } from '../utils/navigationHelper';
import {
  convertVectorFeatureToPlace,
  isFoodOrVenueFeature,
  scanRenderedMapPlaces,
} from '../services/maps/vectorTileScanner';
import { generateFogOfWarGeoJSON } from '../services/maps/fogOfWarHelper';
import { FogOfWarHUD } from './FogOfWarHUD';
import { FomoLiveTicker } from './FomoLiveTicker';
import { MysteryDropModal } from './MysteryDropModal';
import { BiteRouletteModal } from './BiteRouletteModal';
import { TrafficSmartNavigatorSheet } from './TrafficSmartNavigatorSheet';
import { SmartVenueComparatorModal } from './SmartVenueComparatorModal';
import { TrafficRouteResult } from '../services/maps/trafficSmartRoutingService';
import {
  getOrUpdateHotnessSnapshot,
  calculateVenueHotness,
  formatTimeUntilNext24hUpdate,
} from '../services/hotnessEngine';

interface MapViewProps {
  places: Place[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place | null) => void;
  onNavigateToCamera: (place?: Place, context?: { mode?: 'scout' | 'echo' | 'quest'; title?: string }) => void;
  onSavePlaceToggle: (placeId: string) => void;
  savedPlaceIds: string[];
  feedBites?: BiteCheckin[];
  passport?: DistrictPassport;
  user?: User;
  isRadarOpen?: boolean;
  onRadarOpenChange?: (open: boolean) => void;
  onOpenBiteBot?: () => void;
  onOpenMenu?: () => void;
  onOpenNotifications?: () => void;
  targetMapFocus?: { latitude: number; longitude: number; name?: string } | null;
  onClearTargetMapFocus?: () => void;
  openTrafficSheetDirectly?: boolean;
}

export type ExploreMode = 'radar' | 'friends' | 'quest';

// Fog of War layer definitions (Atmospheric mist with glowing beacons around explored areas)
const fogFillLayer: any = {
  id: 'fog-mask-fill',
  type: 'fill',
  source: 'fog-of-war-source',
  filter: ['==', ['get', 'type'], 'fog-mask'],
  paint: {
    'fill-color': '#0B132B',
    'fill-opacity': 0.88,
  },
};

const fogUserBeaconGlowLayer: any = {
  id: 'fog-user-beacon-glow',
  type: 'line',
  source: 'fog-of-war-source',
  filter: ['==', ['get', 'type'], 'user-beacon'],
  paint: {
    'line-color': '#38BDF8',
    'line-width': 3.5,
    'line-opacity': 0.9,
    'line-blur': 2,
  },
};

const fogVisitedBeaconGlowLayer: any = {
  id: 'fog-visited-beacon-glow',
  type: 'line',
  source: 'fog-of-war-source',
  filter: ['==', ['get', 'type'], 'visited-beacon'],
  paint: {
    'line-color': '#F59E0B',
    'line-width': 2.5,
    'line-opacity': 0.85,
    'line-blur': 1.5,
  },
};

// Traffic-Smart Route polyline styling layers
const trafficRouteCasingLayer: any = {
  id: 'traffic-route-casing',
  type: 'line',
  source: 'traffic-route-source',
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#FFFFFF',
    'line-width': 7,
    'line-opacity': 0.95,
  },
};

const trafficRouteLineLayer: any = {
  id: 'traffic-route-line',
  type: 'line',
  source: 'traffic-route-source',
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': [
      'case',
      ['==', ['get', 'trafficLevel'], 'smooth'],
      '#10B981',
      ['==', ['get', 'trafficLevel'], 'moderate'],
      '#F59E0B',
      '#EF4444',
    ],
    'line-width': 4.5,
    'line-opacity': 0.95,
  },
};

// MapLibre native clustering layer definitions for background F&B POIs (Subtle, calm, secondary cluster indicators)
const clusterLayer: any = {
  id: 'clusters',
  type: 'circle',
  source: 'background-pois',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step',
      ['get', 'point_count'],
      '#78716C', // neutral stone-500 (small groups)
      12,
      '#57534E', // stone-600 (medium groups)
      35,
      '#44403C', // stone-700 (dense areas)
    ],
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      9.5, // Small & discreet: 9.5px radius for <12 points
      12,
      12, // 12px for 12-34 points
      35,
      14.5, // Max 14.5px radius for 35+ points (Never giant black circles)
    ],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#FFFFFF',
    'circle-opacity': 0.82,
  },
};

const clusterCountLayer: any = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'background-pois',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['Noto Sans Bold'],
    'text-size': 10,
  },
  paint: {
    'text-color': '#FFFFFF',
  },
};

// Medium/Close Zoom category icon symbol layer - Clean Level of Detail scaling with collision detection
const unclusteredCategoryIconLayer: any = {
  id: 'unclustered-category-icon',
  type: 'symbol',
  source: 'background-pois',
  minzoom: 12.8,
  layout: {
    'icon-image': ['coalesce', ['get', 'iconName'], 'icon-other_food-unvisited'],
    'icon-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      12.8,
      0.72,
      14.5,
      0.92,
      16.5,
      1.1,
    ],
    'icon-allow-overlap': false,
    'icon-ignore-placement': false,
    'icon-padding': 8,
  },
  paint: {
    'icon-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      12.8,
      0.65,
      14,
      0.95,
    ],
  },
};

// Ambient Venue Name Label Layer (Consumer map style, zoom-scaled with collision handling)
const ambientVenueLabelLayer: any = {
  id: 'ambient-venue-labels',
  type: 'symbol',
  source: 'background-pois',
  minzoom: 14.2,
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      14.2,
      10.5,
      16,
      12.5,
    ],
    'text-offset': [0, 1.3],
    'text-anchor': 'top',
    'text-max-width': 9.5,
    'text-padding': 4,
    'text-optional': true,
    'text-allow-overlap': false,
    'text-ignore-placement': false,
  },
  paint: {
    'text-color': [
      'case',
      ['==', ['get', 'isVisited'], 1],
      '#065F46',
      ['==', ['get', 'isHot'], 1],
      '#C2410C',
      '#44403C',
    ],
    'text-halo-color': '#FFFFFF',
    'text-halo-width': 2.5,
    'text-halo-blur': 0.5,
    'text-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      14.2,
      0.8,
      15.5,
      1.0,
    ],
  },
};

// Promoted / Curated BiteQuest places native WebGL symbol layers
const promotedPlacesIconLayer: any = {
  id: 'promoted-places-icons',
  type: 'symbol',
  source: 'promoted-places-source',
  layout: {
    'icon-image': ['coalesce', ['get', 'iconName'], 'icon-other_food-unvisited'],
    'icon-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      11.5,
      0.72,
      13.5,
      0.9,
      15.5,
      1.08,
      17.5,
      1.25,
    ],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'icon-padding': 4,
  },
  paint: {
    'icon-opacity': [
      'case',
      ['==', ['get', 'isDimmed'], 1],
      0.35,
      0.95,
    ],
  },
};

const promotedPlacesLabelLayer: any = {
  id: 'promoted-places-labels',
  type: 'symbol',
  source: 'promoted-places-source',
  minzoom: 13.5,
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Bold'],
    'text-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      13.5,
      10,
      15.5,
      11.5,
      17.5,
      13,
    ],
    'text-offset': [0, 1.35],
    'text-anchor': 'top',
    'text-max-width': 9.5,
    'text-padding': 3,
    'text-optional': true,
    'text-allow-overlap': false,
    'text-ignore-placement': false,
  },
  paint: {
    'text-color': [
      'case',
      ['==', ['get', 'isVisited'], 1],
      '#065F46',
      ['==', ['get', 'isHot'], 1],
      '#C2410C',
      '#1C1917',
    ],
    'text-halo-color': '#FFFFFF',
    'text-halo-width': 2.5,
    'text-halo-blur': 0.5,
    'text-opacity': [
      'case',
      ['==', ['get', 'isDimmed'], 1],
      0.4,
      0.95,
    ],
  },
};

// Fallback map center in Cầu Giấy (explicitly used when browser GPS is unavailable/denied)
const FALLBACK_CENTER = { latitude: 21.0285, longitude: 105.7958 };

export const MapView: React.FC<MapViewProps> = ({
  places,
  selectedPlace,
  onSelectPlace,
  onNavigateToCamera,
  onSavePlaceToggle,
  savedPlaceIds,
  feedBites = [],
  passport = EMPTY_PASSPORT_CAU_GIAY,
  user = EMPTY_USER,
  isRadarOpen = false,
  onRadarOpenChange,
  onOpenBiteBot,
  onOpenMenu,
  onOpenNotifications,
  targetMapFocus,
  onClearTargetMapFocus,
  openTrafficSheetDirectly,
}) => {
  const [exploreMode, setExploreMode] = useState<ExploreMode>('radar');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<ExploreFilterCategory>('ALL');
  const [, setMapLoadError] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>(() => {
    try {
      const saved = localStorage.getItem('bitequest_map_mode');
      if (saved === 'satellite') return 'satellite';
      if (saved === 'fog_of_war') return 'fog_of_war';
      if (saved === 'street') return 'street';
    } catch {
      // ignore
    }
    return 'street'; // Default to crystal clear, bright street map
  });
  const [showLayerSwitcher, setShowLayerSwitcher] = useState(false);
  const [isRadarBoosted, setIsRadarBoosted] = useState(false);
  const [showMysteryDrop, setShowMysteryDrop] = useState(false);
  const [showRoulette, setShowRoulette] = useState(false);
  const [showTrafficSheet, setShowTrafficSheet] = useState(false);
  const [selectedTrafficRoute, setSelectedTrafficRoute] = useState<TrafficRouteResult | null>(null);
  const [showComparatorModal, setShowComparatorModal] = useState(false);
  const [comparatorInitialVenues, setComparatorInitialVenues] = useState<(Place | UnifiedPlace)[]>([]);
  const [currentZoom, setCurrentZoom] = useState<number>(14.5);
  const mapRef = useRef<MapRef | null>(null);

  const handleOpenComparator = (initialVenues?: (Place | UnifiedPlace)[]) => {
    if (initialVenues && initialVenues.length > 0) {
      setComparatorInitialVenues(initialVenues);
    } else if (selectedPlace) {
      setComparatorInitialVenues([selectedPlace]);
    } else {
      setComparatorInitialVenues([]);
    }
    setShowComparatorModal(true);
  };

  const handleTriggerRadarScan = () => {
    setIsRadarBoosted(true);
    setTimeout(() => {
      setIsRadarBoosted(false);
    }, 6000);
  };

  const handleSelectMapMode = (mode: MapMode) => {
    setMapMode(mode);
    try {
      localStorage.setItem('bitequest_map_mode', mode);
    } catch {
      // ignore
    }
    setShowLayerSwitcher(false);
  };

  // Real browser geolocation state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasRealLocation, setHasRealLocation] = useState(false);
  const [, setIsLocating] = useState(false);

  // One-shot initialization and warning throttling refs
  const initialGeolocatedRef = useRef(false);
  const hasLoggedGeoWarningRef = useRef(false);

  // Live Geoapify background POIs state via dedicated hook
  const {
    nearbyPOIs,
    isLoadingPOIs,
    provenance,
    isBeyondBoundary,
    lastFetchedCenter,
    rippleStage,
    fetchNearbyPOIs,
    triggerRippleExpansion,
    loadPlacesForViewportArea,
    filterPlacesTo50kmRadius,
    addDiscoveredPOIs,
  } = useExploreNearbyPlaces();
  const [selectedBackgroundPOI, setSelectedBackgroundPOI] = useState<UnifiedPlace | null>(null);
  const [viewportCenter, setViewportCenter] = useState<{ latitude: number; longitude: number }>(FALLBACK_CENTER);
  const [viewportRadius, setViewportRadius] = useState<number>(2500);
  const [isPioneerBannerDismissed, setIsPioneerBannerDismissed] = useState<boolean>(false);
  const [isAreaSearching, setIsAreaSearching] = useState<boolean>(false);
  const [areaSearchLoadedCount, setAreaSearchLoadedCount] = useState<number | null>(null);
  const [isStyleFallbackActive, setIsStyleFallbackActive] = useState<boolean>(false);
  const moveEndDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to calculate the viewport frame radius (distance from center to visible bounds)
  const calculateViewportRadius = useCallback((): number => {
    const map = mapRef.current?.getMap();
    if (!map) return 3000;
    try {
      const bounds = map.getBounds();
      const ne = bounds.getNorthEast();
      const center = map.getCenter();
      const spanM = getDistance(
        { latitude: center.lat, longitude: center.lng },
        { latitude: ne.lat, longitude: ne.lng }
      );
      // Min 1200m (zoomed in), Max 6500m (when viewing town / city level)
      return Math.min(Math.max(Math.round(spanM), 1200), 6500);
    } catch {
      return 3000;
    }
  }, []);

  const isVenueSelected = Boolean(selectedPlace || selectedBackgroundPOI);
  const mapConfig = useMemo(() => getMapLibreConfig(), []);

  // Re-register custom category icons whenever style changes (street <-> satellite)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      const teardown = setupMapIconLifecycle(map);
      return () => {
        teardown();
      };
    }
  }, [mapMode]);

  // Request real browser geolocation on initial mount & trigger automatic ripple expansion
  useEffect(() => {
    if (initialGeolocatedRef.current) return;
    initialGeolocatedRef.current = true;

    // Immediately trigger ripple expansion starting from default center:
    // First immediate perimeter (2.5km), then auto-radiating outwards to 6km, 12km, 20km
    triggerRippleExpansion(FALLBACK_CENTER, {
      anchor: { latitude: FALLBACK_CENTER.latitude, longitude: FALLBACK_CENTER.longitude, isRealUserLocation: false },
    });

    let isMounted = true;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isMounted) return;
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setUserLocation(coords);
          setHasRealLocation(true);
          setIsLocating(false);
          setViewportCenter(coords);
          
          // Trigger automatic ripple outward expansion from real user coordinates
          triggerRippleExpansion(coords, {
            anchor: { latitude: coords.latitude, longitude: coords.longitude, isRealUserLocation: true },
          });

          mapRef.current?.flyTo({
            center: [coords.longitude, coords.latitude],
            zoom: 15,
            duration: 800,
          });
        },
        (err) => {
          if (!isMounted) return;
          if (!hasLoggedGeoWarningRef.current) {
            hasLoggedGeoWarningRef.current = true;
            console.warn('[Explore] Geolocation not granted, maintaining Cầu Giấy center:', err.message);
          }
          setHasRealLocation(false);
          setUserLocation(null);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    } else {
      setHasRealLocation(false);
      setUserLocation(null);
    }

    return () => {
      isMounted = false;
    };
  }, [triggerRippleExpansion]);

  // Handle external focus target (e.g. from Traffic Notification center)
  useEffect(() => {
    if (targetMapFocus?.latitude && targetMapFocus?.longitude) {
      mapRef.current?.flyTo({
        center: [targetMapFocus.longitude, targetMapFocus.latitude],
        zoom: 16.2,
        duration: 1000,
      });
    }
  }, [targetMapFocus]);

  // Handle direct opening of traffic sheet
  useEffect(() => {
    if (openTrafficSheetDirectly) {
      setShowTrafficSheet(true);
    }
  }, [openTrafficSheetDirectly]);

  // Force map resize on mount and after layout transitions
  useEffect(() => {
    const timer1 = setTimeout(() => {
      mapRef.current?.resize();
    }, 100);
    const timer2 = setTimeout(() => {
      mapRef.current?.resize();
    }, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Compute reference location for distance & opportunities (User GPS if available, else fallback center)
  const referenceLocation = useMemo(() => {
    return {
      latitude: (userLocation || FALLBACK_CENTER).latitude,
      longitude: (userLocation || FALLBACK_CENTER).longitude,
      isRealUserLocation: hasRealLocation && Boolean(userLocation),
    };
  }, [userLocation, hasRealLocation]);

  // Mystery Drop Treasure Chest dynamic coordinate near the current viewport/user
  const mysteryChestCoords = useMemo(() => {
    return {
      latitude: referenceLocation.latitude + 0.0028,
      longitude: referenceLocation.longitude + 0.0035,
    };
  }, [referenceLocation]);

  // Deduplicate live Geoapify POIs against BiteQuest verified / promoted places and within itself
  const unpromotedNearbyPOIs = useMemo(() => {
    const filtered = nearbyPOIs.filter((poi) => {
      // 1. Exact ID or provider ID match
      const exactMatch = places.some(
        (p) =>
          (p.googlePlaceId && (p.googlePlaceId === poi.providerId || p.googlePlaceId === poi.id)) ||
          p.id === poi.id
      );
      if (exactMatch) return false;

      // 2. Spatial distance (< 25m) + normalized exact name match heuristic
      const spatialMatch = places.some((p) => {
        const dist = getDistance(
          { latitude: p.latitude, longitude: p.longitude },
          { latitude: poi.latitude, longitude: poi.longitude }
        );
        return dist < 25 && p.name.trim().toLowerCase() === poi.name.trim().toLowerCase();
      });
      return !spatialMatch;
    });

    return deduplicateVenuesList(filtered);
  }, [nearbyPOIs, places]);

  // All verified and community places loaded nationwide across 3 regions
  const localPromotedPlaces = useMemo(() => {
    const valid = places.filter((p) => {
      return typeof p.latitude === 'number' && typeof p.longitude === 'number';
    });
    return deduplicateVenuesList(valid);
  }, [places]);

  // Dynamic filter chips derived strictly from all venues in current map area
  const allLoadedVenues = useMemo(() => {
    return deduplicateVenuesList([...localPromotedPlaces, ...unpromotedNearbyPOIs]);
  }, [localPromotedPlaces, unpromotedNearbyPOIs]);

  // 24-Hour Hotness Snapshot Engine (Automatically recalculates every 24h based on ratings, press reviews, and check-ins)
  const hotnessSnapshot = useMemo(() => {
    return getOrUpdateHotnessSnapshot(allLoadedVenues);
  }, [allLoadedVenues]);

  // Generate Deterministic Bite Opportunities via Radar Engine
  const radarOpportunities = useMemo(() => {
    return generateBiteOpportunities({
      userLocation: referenceLocation,
      places: allLoadedVenues,
      feedBites,
      passport,
      user,
      savedPlaceIds,
      mode: exploreMode,
    });
  }, [referenceLocation, allLoadedVenues, feedBites, passport, user, savedPlaceIds, exploreMode]);

  // Derive Today Opportunities (Max 3, deduplicated, truthful)
  const visitedPlaceIds = useMemo(() => {
    const visited = new Set<string>();
    (feedBites || []).forEach((b) => {
      if (b.isVerified && (b.userId === user?.id || !user?.id || b.userId === 'user_current')) {
        if (b.placeId) visited.add(b.placeId);
      }
    });
    if ((passport as any)?.districts) {
      (passport as any).districts.forEach((d: any) => {
        d.visitedPlaceIds?.forEach((pid: string) => visited.add(pid));
      });
    }
    places.forEach((p) => {
      if ((p as any).userVisited || (p.verifiedByUserId && p.verifiedByUserId === user?.id)) {
        visited.add(p.id);
        if (p.providerPlaceId) visited.add(p.providerPlaceId);
      }
    });
    return visited;
  }, [feedBites, user?.id, passport, places]);

  // Visited geo-points for persistent Fog of War cleared zone beacons
  const visitedLocations = useMemo(() => {
    const locs: { latitude: number; longitude: number; name?: string }[] = [];
    allLoadedVenues.forEach((venue: any) => {
      if (
        visitedPlaceIds.has(venue.id) ||
        (venue.providerPlaceId && visitedPlaceIds.has(venue.providerPlaceId)) ||
        (venue.googlePlaceId && visitedPlaceIds.has(venue.googlePlaceId)) ||
        venue.userVisited
      ) {
        if (typeof venue.latitude === 'number' && typeof venue.longitude === 'number') {
          locs.push({
            latitude: venue.latitude,
            longitude: venue.longitude,
            name: venue.name,
          });
        }
      }
    });
    (feedBites || []).forEach((b: any) => {
      if (typeof b.latitude === 'number' && typeof b.longitude === 'number') {
        locs.push({
          latitude: b.latitude,
          longitude: b.longitude,
          name: b.placeName,
        });
      }
    });
    return locs;
  }, [allLoadedVenues, visitedPlaceIds, feedBites]);

  // Atmospheric Fog of War dynamic GeoJSON mask with holes
  const fogGeoJSON = useMemo(() => {
    return generateFogOfWarGeoJSON({
      userLocation: referenceLocation,
      visitedLocations,
      visionRadiusMeters: 650,
      visitedRadiusMeters: 400,
      radarBoostActive: isRadarBoosted,
    });
  }, [referenceLocation, visitedLocations, isRadarBoosted]);

  // Traffic-Smart Route GeoJSON feature
  const trafficRouteGeoJSON = useMemo(() => {
    if (!selectedTrafficRoute || !selectedTrafficRoute.routeCoordinates || selectedTrafficRoute.routeCoordinates.length === 0) {
      return null;
    }
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {
            trafficLevel: selectedTrafficRoute.trafficLevel,
            trafficScore: selectedTrafficRoute.trafficScore,
            delayMinutes: selectedTrafficRoute.delayMinutes,
            placeName: selectedTrafficRoute.place?.name,
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: selectedTrafficRoute.routeCoordinates,
          },
        },
      ],
    };
  }, [selectedTrafficRoute]);

  const todayResult = useMemo(() => {
    return adaptBiteOpportunities(radarOpportunities, {
      userPreferences: user?.foodPreferences,
      isRealUserLocation: referenceLocation.isRealUserLocation,
      visitedPlaceIds,
      maxLimit: 3,
    });
  }, [radarOpportunities, user?.foodPreferences, referenceLocation.isRealUserLocation, visitedPlaceIds]);

  // Check if map camera has panned significantly far (> 3.5km) from user GPS or base
  const isPannedFarFromBase = useMemo(() => {
    const base = lastFetchedCenter || userLocation || FALLBACK_CENTER;
    if (!base || !viewportCenter) return false;
    const dist = getDistance(
      { latitude: base.latitude, longitude: base.longitude },
      { latitude: viewportCenter.latitude, longitude: viewportCenter.longitude }
    );
    return dist > 3500;
  }, [lastFetchedCenter, userLocation, viewportCenter]);

  const todayOpportunities = todayResult.opportunities;

  // Map opportunity lookup by placeId
  const opportunityMap = useMemo(() => {
    const map = new Map<string, BiteOpportunity>();
    radarOpportunities.forEach((opp) => map.set(opp.placeId, opp));
    return map;
  }, [radarOpportunities]);

  const [showFullFilterSheet, setShowFullFilterSheet] = useState(false);

  const quickFilterChips = useMemo(() => {
    return computeQuickFilterChips(allLoadedVenues, activeCategoryFilter);
  }, [allLoadedVenues, activeCategoryFilter]);

  const allCategoryFilterCounts = useMemo(() => {
    return computeAllCategoryFilterCounts(allLoadedVenues, activeCategoryFilter);
  }, [allLoadedVenues, activeCategoryFilter]);

  const handleSelectCategoryFilter = useCallback(
    (filter: ExploreFilterCategory) => {
      setActiveCategoryFilter(filter);
      if (filter !== 'ALL') {
        if (selectedPlace && normalizeCategory(selectedPlace) !== filter) {
          onSelectPlace(null);
        }
        if (selectedBackgroundPOI && normalizeCategory(selectedBackgroundPOI) !== filter) {
          setSelectedBackgroundPOI(null);
        }
      }
    },
    [selectedPlace, selectedBackgroundPOI, onSelectPlace]
  );

  // Client-side filtering for ambient POIs (Zero network fetch)
  const filteredUnpromotedNearbyPOIs = useMemo(() => {
    return unpromotedNearbyPOIs.filter((poi) => {
      // 1. Category Filter
      if (activeCategoryFilter !== 'ALL') {
        const cat = normalizeCategory(poi);
        if (cat !== activeCategoryFilter) return false;
      }
      // 2. Search Query (Accent-tolerant & keyword matching)
      if (searchQuery.trim()) {
        if (!matchVenueSearch(poi, searchQuery)) return false;
      }
      return true;
    });
  }, [unpromotedNearbyPOIs, activeCategoryFilter, searchQuery]);

  // GeoJSON FeatureCollection for background clustered POI layer
  const backgroundPOIGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: filteredUnpromotedNearbyPOIs.map((poi) => {
        const canonicalCat = normalizeCategory({
          name: poi.name,
          category: poi.category,
          categoryLabel: poi.categoryLabel,
          categories: (poi as any).categories,
        });
        const meta = getCategoryMetadata(canonicalCat);
        const isVisited =
          visitedPlaceIds.has(poi.id) ||
          Boolean(poi.providerId && visitedPlaceIds.has(poi.providerId)) ||
          Boolean((poi as any).googlePlaceId && visitedPlaceIds.has((poi as any).googlePlaceId));

        const vId = poi.id || (poi as any).providerId || poi.name;
        const hotness = hotnessSnapshot.venues[vId] || calculateVenueHotness(poi, hotnessSnapshot.calculatedAt);
        const isHot = !isVisited && hotness.isHot;

        const iconName = isVisited
          ? `icon-${canonicalCat.toLowerCase()}-visited`
          : isHot
          ? `icon-${canonicalCat.toLowerCase()}-hot`
          : `icon-${canonicalCat.toLowerCase()}-unvisited`;

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [poi.longitude, poi.latitude],
          },
          properties: {
            id: poi.id,
            name: poi.name,
            category: poi.category,
            canonicalCategory: canonicalCat,
            categoryLabel: meta.label,
            categoryShortLabel: meta.shortLabel,
            iconName,
            isVisited: isVisited ? 1 : 0,
            isHot: isHot ? 1 : 0,
            hotScore: hotness.hotScore,
            hotBadgeLabel: hotness.badgeLabel,
            hotReason: hotness.reasons[0] || '',
            pressSource: hotness.pressMention?.source || '',
            color: isVisited ? '#10B981' : isHot ? '#EA580C' : '#3F3F46',
            address: poi.address,
            district: poi.district,
            city: poi.city || 'Hà Nội',
            distanceMeters: poi.distanceMeters,
            verifiedBiteCount: (poi as any).verifiedBiteCount || 0,
          },
        };
      }),
    };
  }, [filteredUnpromotedNearbyPOIs, visitedPlaceIds, hotnessSnapshot]);

  // Filter promoted places in active area (Zero network fetch)
  const filteredPlaces = useMemo(() => {
    return localPromotedPlaces.filter((place) => {
      // 1. Category Filter
      if (activeCategoryFilter !== 'ALL') {
        const cat = normalizeCategory(place);
        if (cat !== activeCategoryFilter) return false;
      }
      // 2. Search Query (Accent-tolerant & keyword matching)
      if (searchQuery.trim()) {
        if (!matchVenueSearch(place, searchQuery)) return false;
      }
      return true;
    });
  }, [localPromotedPlaces, activeCategoryFilter, searchQuery]);

  const activePlace = selectedPlace;
  const activeSelectedPlace = activePlace || selectedTrafficRoute?.place;
  const activeOpportunity = activePlace ? opportunityMap.get(activePlace.id) : null;
  const isSaved = activePlace ? savedPlaceIds.includes(activePlace.id) : false;

  // Curated Promoted BiteQuest Places GeoJSON FeatureCollection (GPU WebGL hardware-accelerated)
  const promotedPlacesGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = useMemo(() => {
    const topRecommendationId = todayOpportunities.length > 0 ? todayOpportunities[0].venueId : null;

    return {
      type: 'FeatureCollection',
      features: filteredPlaces
        // Exclude currently active selected place so it doesn't duplicate beneath the high-fidelity selected HTML Marker
        .filter((place) => place.id !== activeSelectedPlace?.id)
        .map((place) => {
          const canonicalCat = normalizeCategory(place);
          const meta = getCategoryMetadata(canonicalCat);
          const isVisited =
            visitedPlaceIds.has(place.id) ||
            Boolean(place.providerPlaceId && visitedPlaceIds.has(place.providerPlaceId)) ||
            Boolean(place.googlePlaceId && visitedPlaceIds.has(place.googlePlaceId));

          const vId = place.id || (place as any).providerPlaceId || place.name;
          const hotness = hotnessSnapshot.venues[vId] || calculateVenueHotness(place, hotnessSnapshot.calculatedAt);
          const isHot = !isVisited && hotness.isHot;

          const opp = opportunityMap.get(place.id);
          const isScout = opp?.type === 'SCOUT_WINDOW';
          const isQuest = opp?.type === 'QUEST_MATCH';
          const isFriendEcho = opp?.type === 'FRIEND_ECHO' && Boolean(opp.friendActivity);
          const isFriendActive = isFriendEcho || (place.friendsVisited && place.friendsVisited.length > 0);
          const isQuestActive = isQuest || isScout;

          const isDimmedInMode =
            (exploreMode === 'friends' && !isFriendActive) ||
            (exploreMode === 'quest' && !isQuestActive);

          const isTopRecommended = topRecommendationId === place.id;

          const iconName = isVisited
            ? `icon-${canonicalCat.toLowerCase()}-visited`
            : isHot
            ? `icon-${canonicalCat.toLowerCase()}-hot`
            : `icon-${canonicalCat.toLowerCase()}-unvisited`;

          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [place.longitude, place.latitude],
            },
            properties: {
              id: place.id,
              name: place.name,
              category: place.category,
              canonicalCategory: canonicalCat,
              categoryLabel: meta.label,
              iconName,
              isVisited: isVisited ? 1 : 0,
              isHot: isHot ? 1 : 0,
              isScout: isScout ? 1 : 0,
              isQuest: isQuest ? 1 : 0,
              isTopRecommended: isTopRecommended ? 1 : 0,
              isDimmed: isDimmedInMode ? 1 : 0,
            },
          };
        }),
    };
  }, [
    filteredPlaces,
    activeSelectedPlace?.id,
    visitedPlaceIds,
    hotnessSnapshot,
    opportunityMap,
    todayOpportunities,
    exploreMode,
  ]);

  // Filtered radar opportunities for the bottom carousel
  const displayedOpportunities = useMemo(() => {
    if (activeCategoryFilter === 'ALL' && !searchQuery.trim()) {
      return radarOpportunities;
    }
    return radarOpportunities.filter((opp) => {
      if (activeCategoryFilter !== 'ALL') {
        const cat = normalizeCategory(opp.place);
        if (cat !== activeCategoryFilter) return false;
      }
      if (searchQuery.trim() && !matchVenueSearch(opp.place, searchQuery)) {
        return false;
      }
      return true;
    });
  }, [radarOpportunities, activeCategoryFilter, searchQuery]);

  const activeDistanceM = useMemo(() => {
    if (!activePlace) return 0;
    return getDistance(
      referenceLocation,
      { latitude: activePlace.latitude, longitude: activePlace.longitude }
    );
  }, [activePlace, referenceLocation]);

  const formattedDistance =
    activeDistanceM < 1000 ? `${activeDistanceM}m` : `${(activeDistanceM / 1000).toFixed(1)}km`;

  // Nearest available venue across all loaded venues (for smart sparse area fallback)
  const nearestAvailableVenue = useMemo(() => {
    if (allLoadedVenues.length === 0) return null;
    let minD = Infinity;
    let closest: UnifiedPlace | null = null;
    for (const v of allLoadedVenues) {
      const d = getDistance(referenceLocation, { latitude: v.latitude, longitude: v.longitude });
      if (d < minD) {
        minD = d;
        closest = v as any;
      }
    }
    return closest ? { venue: closest, distanceMeters: minD } : null;
  }, [allLoadedVenues, referenceLocation]);

  // Selected background POI distance calculation
  const selectedPOIDistanceM = useMemo(() => {
    if (!selectedBackgroundPOI) return null;
    return getDistance(referenceLocation, {
      latitude: selectedBackgroundPOI.latitude,
      longitude: selectedBackgroundPOI.longitude,
    });
  }, [selectedBackgroundPOI, referenceLocation]);

  const handleFlyTo = (lat: number, lng: number, customZoom = 15.5) => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: customZoom,
      duration: 1000,
    });
  };

  const handleSelectOpportunity = (opp: BiteOpportunity) => {
    setSelectedBackgroundPOI(null);
    onSelectPlace(opp.place);
    handleFlyTo(opp.place.latitude, opp.place.longitude);
  };

  const handleSelectVenueFromPeek = useCallback(
    (venueId: string) => {
      const promoted = places.find((p) => p.id === venueId);
      if (promoted) {
        setSelectedBackgroundPOI(null);
        onSelectPlace(promoted);
        handleFlyTo(promoted.latitude, promoted.longitude);
        return;
      }
      const poi = nearbyPOIs.find((p) => p.id === venueId);
      if (poi) {
        onSelectPlace(null);
        setSelectedBackgroundPOI(poi);
        handleFlyTo(poi.latitude, poi.longitude);
        return;
      }
      const unpromoted = unpromotedNearbyPOIs.find((p) => p.id === venueId);
      if (unpromoted) {
        onSelectPlace(null);
        setSelectedBackgroundPOI(unpromoted);
        handleFlyTo(unpromoted.latitude, unpromoted.longitude);
      }
    },
    [places, nearbyPOIs, unpromotedNearbyPOIs, onSelectPlace]
  );

  const handleOpportunityAction = (opp: BiteOpportunity) => {
    if (opp.type === 'SCOUT_WINDOW') {
      onNavigateToCamera(opp.place, { mode: 'scout', title: 'Xác minh điểm mới' });
    } else if (opp.type === 'QUEST_MATCH') {
      onNavigateToCamera(opp.place, { mode: 'quest', title: opp.questMatch?.challengeTitle });
    } else if (opp.type === 'STARTER_QUEST') {
      onNavigateToCamera(opp.place, { mode: 'quest', title: 'Bite đầu tiên' });
    } else if (opp.type === 'FRIEND_ECHO') {
      onNavigateToCamera(opp.place, { mode: 'echo', title: 'Đi theo dấu bạn bè' });
    } else {
      onNavigateToCamera(opp.place);
    }
  };

  // MapLibre click handler: intercepts cluster expansions, unclustered POIs, and any vector tile venue tap
  const handleMapClick = useCallback((event: any) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // 1. Check custom BiteQuest GeoJSON interactive layers
    const features = map.queryRenderedFeatures(event.point, {
      layers: ['clusters', 'promoted-places-icons', 'promoted-places-labels', 'unclustered-category-icon', 'ambient-venue-labels'],
    });

    if (features && features.length > 0) {
      const feature = features[0];

      // Handle cluster tap -> zoom in smoothly to expand
      if (feature.layer.id === 'clusters') {
        const clusterId = feature.properties?.cluster_id;
        const source: any = map.getSource('background-pois');
        if (source && typeof source.getClusterExpansionZoom === 'function') {
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return;
            map.easeTo({
              center: (feature.geometry as any).coordinates,
              zoom: Math.min(zoom + 0.6, 16.5),
              duration: 500,
            });
          });
        } else {
          map.easeTo({
            center: (feature.geometry as any).coordinates,
            zoom: map.getZoom() + 2,
            duration: 500,
          });
        }
        return;
      }

      // Handle promoted / curated place tap from native WebGL layer
      if (
        feature.layer.id === 'promoted-places-icons' ||
        feature.layer.id === 'promoted-places-labels'
      ) {
        const placeId = feature.properties?.id;
        const place =
          places.find((p) => p.id === placeId) ||
          localPromotedPlaces.find((p) => p.id === placeId) ||
          allLoadedVenues.find((p) => (p as any).id === placeId);

        if (place) {
          setSelectedBackgroundPOI(null);
          onSelectPlace(place as Place);
          handleFlyTo(place.latitude, place.longitude);
          return;
        }
      }

      if (
        feature.layer.id === 'unclustered-category-icon' ||
        feature.layer.id === 'ambient-venue-labels'
      ) {
        const poiId = feature.properties?.id;
        const poi =
          nearbyPOIs.find((p) => p.id === poiId) ||
          places.find((p) => p.id === poiId) ||
          unpromotedNearbyPOIs.find((p) => p.id === poiId) ||
          allLoadedVenues.find((p) => (p as any).id === poiId);

        if (poi) {
          onSelectPlace(null);
          setSelectedBackgroundPOI(poi);
          handleFlyTo(poi.latitude, poi.longitude);
        } else if (feature.properties?.name && isFoodOrVenueFeature(feature.properties, feature.layer?.id)) {
          const coords = (feature.geometry as any)?.coordinates;
          const fallbackPoi: UnifiedPlace = {
            id: poiId || `poi_${Date.now()}`,
            name: feature.properties.name,
            category: feature.properties.category || 'street_food',
            categoryLabel: feature.properties.categoryLabel || 'Ẩm thực',
            address: feature.properties.address || '',
            district: feature.properties.district || 'Hà Nội',
            city: feature.properties.city || 'Hà Nội',
            latitude: coords ? coords[1] : referenceLocation.latitude,
            longitude: coords ? coords[0] : referenceLocation.longitude,
          };
          onSelectPlace(null);
          setSelectedBackgroundPOI(fallbackPoi);
          handleFlyTo(fallbackPoi.latitude, fallbackPoi.longitude);
        }
        return;
      }
    }

    // 2. Spatial search for any vector map tile feature at/near the click point (tolerance 24px)
    try {
      const bbox: any = [
        [event.point.x - 24, event.point.y - 24],
        [event.point.x + 24, event.point.y + 24],
      ];
      const renderedFeatures = map.queryRenderedFeatures(bbox);
      let clickedVenue: UnifiedPlace | null = null;

      for (const f of renderedFeatures) {
        if (isFoodOrVenueFeature(f.properties, f.layer?.id)) {
          const place = convertVectorFeatureToPlace(f, referenceLocation);
          if (place) {
            clickedVenue = place;
            break;
          }
        }
      }

      if (clickedVenue) {
        addDiscoveredPOIs([clickedVenue]);
        onSelectPlace(null);
        setSelectedBackgroundPOI(clickedVenue);
        handleFlyTo(clickedVenue.latitude, clickedVenue.longitude);
        return;
      }
    } catch (err) {
      console.warn('[handleMapClick] Vector feature tap error:', err);
    }

    // Tapping empty map dismisses active place & background POI cards
    onSelectPlace(null);
    setSelectedBackgroundPOI(null);
  }, [nearbyPOIs, places, unpromotedNearbyPOIs, allLoadedVenues, referenceLocation, onSelectPlace, addDiscoveredPOIs]);

  // Viewport tracking & smooth ambient loading when panning to new areas
  const handleMapMoveEnd = useCallback(
    (e: any) => {
      const map = e.target;
      if (!map) return;
      const center = map.getCenter();
      const newCenter = { latitude: center.lat, longitude: center.lng };
      setViewportCenter(newCenter);
      const newRadius = calculateViewportRadius();
      setViewportRadius(newRadius);
      setCurrentZoom(map.getZoom());

      // Instantly promote all rendered vector tile food & drink venues to interactive BiteQuest pins
      try {
        const vectorVenues = scanRenderedMapPlaces(map, referenceLocation);
        if (vectorVenues.length > 0) {
          addDiscoveredPOIs(vectorVenues);
        }
      } catch (err) {
        console.warn('[handleMapMoveEnd] scanRenderedMapPlaces error:', err);
      }

      if (moveEndDebounceRef.current) {
        clearTimeout(moveEndDebounceRef.current);
      }

      // Debounce panning fetch to 600ms and require at least 800m movement to prevent rapid request floods & lag
      moveEndDebounceRef.current = setTimeout(() => {
        const dist = lastFetchedCenter ? getDistance(lastFetchedCenter, newCenter) : Infinity;
        if (dist > 800) {
          fetchNearbyPOIs(newCenter, Math.max(newRadius, 5000), {
            anchor: {
              latitude: referenceLocation.latitude,
              longitude: referenceLocation.longitude,
              isRealUserLocation: hasRealLocation,
            },
          });
        }
      }, 600);
    },
    [calculateViewportRadius, lastFetchedCenter, referenceLocation, hasRealLocation, fetchNearbyPOIs, addDiscoveredPOIs]
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (moveEndDebounceRef.current) {
        clearTimeout(moveEndDebounceRef.current);
      }
    };
  }, []);

  // Re-center button click: pans to user GPS if available, else re-prompts geolocation
  const handleMyLocationClick = () => {
    if (userLocation && hasRealLocation) {
      handleFlyTo(userLocation.latitude, userLocation.longitude, 16.2);
      triggerRippleExpansion(userLocation, {
        anchor: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          isRealUserLocation: true,
        },
      });

      // Background GPS refinement
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setUserLocation(coords);
            setHasRealLocation(true);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
        );
      }
    } else if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserLocation(coords);
          setHasRealLocation(true);
          setIsLocating(false);
          setViewportCenter(coords);
          handleFlyTo(coords.latitude, coords.longitude, 16.2);
          triggerRippleExpansion(coords, {
            anchor: {
              latitude: coords.latitude,
              longitude: coords.longitude,
              isRealUserLocation: true,
            },
          });
        },
        (err) => {
          console.warn('Geolocation unavailable:', err);
          setIsLocating(false);
          handleFlyTo(FALLBACK_CENTER.latitude, FALLBACK_CENTER.longitude, 15.5);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      handleFlyTo(FALLBACK_CENTER.latitude, FALLBACK_CENTER.longitude, 15.5);
    }
  };

  const activeMapStyle = useMemo(() => {
    return getMapStyleForMode(mapMode, isStyleFallbackActive);
  }, [mapMode, isStyleFallbackActive]);

  const totalVisibleVenues = filteredPlaces.length + filteredUnpromotedNearbyPOIs.length;
  const isFilterActive = activeCategoryFilter !== 'ALL' || Boolean(searchQuery.trim());

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#FAF9F5]" id="map-view-canvas">
      {/* 1. MapLibre GL Vector / Raster Map Canvas */}
      <div className="absolute inset-0 w-full h-full">
        <MapGL
          ref={mapRef}
          mapLib={maplibregl}
          initialViewState={{
            longitude: mapConfig.defaultCenter[0],
            latitude: mapConfig.defaultCenter[1],
            zoom: mapConfig.defaultZoom,
          }}
          mapStyle={activeMapStyle}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
          interactiveLayerIds={['clusters', 'promoted-places-icons', 'promoted-places-labels', 'unclustered-category-icon', 'ambient-venue-labels']}
          onClick={handleMapClick}
          onMove={(e) => {
            if (e.viewState?.zoom) {
              setCurrentZoom(e.viewState.zoom);
            }
          }}
          onMoveEnd={handleMapMoveEnd}
          onError={(event: any) => {
            const errorObj = event?.error || {};
            const errorMsg =
              typeof errorObj === 'string'
                ? errorObj
                : (errorObj as any)?.message ||
                  (typeof event?.message === 'string' ? event.message : '') ||
                  (typeof event?.status === 'number' ? `HTTP ${event.status}` : 'MapLibre event');
            
            console.warn('[MapLibre Event / Error]', errorMsg, event);

            // Log actual error and fallback to Carto Voyager ONLY if OpenFreeMap style itself genuinely fails to load
            if (
              !isStyleFallbackActive &&
              mapMode !== 'satellite' &&
              (errorMsg.toLowerCase().includes('failed to load style') ||
               errorMsg.toLowerCase().includes('could not load style') ||
               (event?.dataType === 'style' && (errorObj?.status >= 400 || errorMsg.includes('fetch'))))
            ) {
              console.warn('[BiteQuest Map Fallback] OpenFreeMap style loading error detected, switching to Carto Voyager fallback. Actual error:', errorMsg);
              setIsStyleFallbackActive(true);
            }
          }}
          onLoad={(e) => {
            setMapLoadError(false);
            const map = e.target;
            setupMapIconLifecycle(map);
            map.resize();
            try {
              const vectorVenues = scanRenderedMapPlaces(map, referenceLocation);
              if (vectorVenues.length > 0) {
                addDiscoveredPOIs(vectorVenues);
              }
            } catch (err) {
              console.warn('[MapGL onLoad] scanRenderedMapPlaces error:', err);
            }
          }}
          onIdle={(e) => {
            const map = e.target;
            if (map) {
              try {
                const vectorVenues = scanRenderedMapPlaces(map, referenceLocation);
                if (vectorVenues.length > 0) {
                  addDiscoveredPOIs(vectorVenues);
                }
              } catch (err) {
                console.warn('[MapGL onIdle] scanRenderedMapPlaces error:', err);
              }
            }
          }}
        >
          {/* Top-right Navigation Controls positioned safely below top bar */}
          <div className="absolute top-32 right-3 z-20 pointer-events-auto">
            <NavigationControl position="top-right" showCompass={false} />
          </div>

          {/* Background POI GeoJSON Layer - Subtle clustering at far zoom, Category symbols at mid/close zoom */}
          <Source
            id="background-pois"
            type="geojson"
            data={backgroundPOIGeoJSON}
            cluster={true}
            clusterMaxZoom={12.5}
            clusterRadius={36}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...unclusteredCategoryIconLayer} />
            <Layer {...ambientVenueLabelLayer} />
          </Source>

          {/* Fog of War RPG Atmospheric Mask & Beacon Glow Layers */}
          {mapMode === 'fog_of_war' && (
            <Source id="fog-of-war-source" type="geojson" data={fogGeoJSON}>
              <Layer {...fogFillLayer} />
              <Layer {...fogUserBeaconGlowLayer} />
              <Layer {...fogVisitedBeaconGlowLayer} />
            </Source>
          )}

          {/* Traffic-Smart Route Colored Polyline Layer */}
          {trafficRouteGeoJSON && (
            <Source id="traffic-route-source" type="geojson" data={trafficRouteGeoJSON}>
              <Layer {...trafficRouteCasingLayer} />
              <Layer {...trafficRouteLineLayer} />
            </Source>
          )}

          {/* Subtle center beacon pulse in Fog of War mode */}
          {mapMode === 'fog_of_war' && (
            <Marker
              longitude={referenceLocation.longitude}
              latitude={referenceLocation.latitude}
              anchor="center"
            >
              <div className="relative pointer-events-none flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-sky-400/40 animate-ping absolute pointer-events-none"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-sky-400 border border-white shadow-md z-10"></div>
              </div>
            </Marker>
          )}

          {/* User Location Pulse Marker (Only displayed when verified real GPS is acquired) */}
          {userLocation && hasRealLocation && (
            <Marker longitude={userLocation.longitude} latitude={userLocation.latitude} anchor="center">
              <div className="relative flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-[#FF6B35]/25 pulse-ring-animation absolute"></div>
                <div className="w-4 h-4 rounded-full bg-[#FF6B35] border-2 border-white shadow-md z-10 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                </div>
              </div>
            </Marker>
          )}

          {/* Highlight Marker for Selected Ambient Venue (Emphasized Name Callout) */}
          {selectedBackgroundPOI && !activePlace && (
            <Marker
              longitude={selectedBackgroundPOI.longitude}
              latitude={selectedBackgroundPOI.latitude}
              anchor="bottom"
            >
              <div className="relative flex flex-col items-center pointer-events-none z-30">
                <div className="w-12 h-12 rounded-full bg-[#FF6B35]/35 pulse-ring-animation absolute -top-1.5"></div>
                <div className="w-9 h-9 rounded-full border-2 border-white shadow-xl flex items-center justify-center bg-[#FF6B35] text-white z-10">
                  <span className="text-base leading-none">
                    {CANONICAL_CATEGORIES[normalizeCategory(selectedBackgroundPOI)]?.symbolGlyph || '🍴'}
                  </span>
                </div>
                <div className="mt-1 px-2.5 py-0.5 rounded-md bg-[#1C1917] text-white text-[11px] font-bold shadow-lg border border-white/40 whitespace-nowrap z-20 flex items-center gap-1">
                  <span>{selectedBackgroundPOI.name}</span>
                </div>
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[#1C1917] -mt-0.5"></div>
              </div>
            </Marker>
          )}

          {/* Interactive Mystery Chest Marker (Flash Drop / FOMO Event) - Clean & Compact */}
          <Marker
            longitude={mysteryChestCoords.longitude}
            latitude={mysteryChestCoords.latitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setShowMysteryDrop(true);
            }}
          >
            <div
              className="relative group cursor-pointer transform hover:scale-125 active:scale-95 transition-all z-25 flex flex-col items-center select-none"
              title="Rương Bí Mật Ẩm Thực (Chạm để mở!)"
              id="marker-mystery-chest"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center text-base shadow-lg border border-white chest-wobble">
                🎁
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-400/25 animate-ping absolute -inset-0.5 pointer-events-none"></div>
            </div>
          </Marker>

          {/* Promoted BiteQuest Layer (GPU Native WebGL Symbol & Label Layers - Single Draw Call) */}
          <Source id="promoted-places-source" type="geojson" data={promotedPlacesGeoJSON}>
            <Layer {...promotedPlacesIconLayer} />
            <Layer {...promotedPlacesLabelLayer} />
          </Source>

          {/* High-Fidelity Active Focused Marker (Rendered only for the single currently active/selected place) */}
          {activeSelectedPlace && (() => {
            const opp = opportunityMap.get(activeSelectedPlace.id);
            const isBookmarked = savedPlaceIds.includes(activeSelectedPlace.id);
            const isVisited =
              visitedPlaceIds.has(activeSelectedPlace.id) ||
              Boolean(activeSelectedPlace.providerPlaceId && visitedPlaceIds.has(activeSelectedPlace.providerPlaceId)) ||
              Boolean(activeSelectedPlace.googlePlaceId && visitedPlaceIds.has(activeSelectedPlace.googlePlaceId));
            const isTopRecommended = todayOpportunities.length > 0 && todayOpportunities[0].venueId === activeSelectedPlace.id;
            const catMeta = CANONICAL_CATEGORIES[normalizeCategory(activeSelectedPlace)];
            const badgeGlyph = catMeta?.symbolGlyph || '🍴';

            return (
              <Marker
                key={activeSelectedPlace.id}
                longitude={activeSelectedPlace.longitude}
                latitude={activeSelectedPlace.latitude}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedBackgroundPOI(null);
                  onSelectPlace(activeSelectedPlace);
                  handleFlyTo(activeSelectedPlace.latitude, activeSelectedPlace.longitude);
                }}
              >
                <div
                  className="relative group cursor-pointer transform scale-110 opacity-100 z-50 transition-all duration-200"
                  id={`marker-promoted-${activeSelectedPlace.id}`}
                >
                  {/* Outer Pulsing Active Choice Ring for Selected Place */}
                  <div className="absolute -inset-2.5 rounded-full bg-[#FF6B35]/40 animate-ping pointer-events-none"></div>

                  {/* Top Recommendation Gợi Ý Ring */}
                  {isTopRecommended && (
                    <div className="absolute -inset-1 rounded-full ring-2 ring-amber-400/70 animate-pulse pointer-events-none"></div>
                  )}

                  {/* Marker Pin Head */}
                  <div
                    className="relative flex items-center justify-center rounded-full border transition-all w-10 h-10 border-2 border-white ring-4 ring-[#FF6B35]/35 shadow-lg text-white"
                    style={{
                      backgroundColor: '#FF6B35',
                      borderColor: '#FFFFFF',
                    }}
                  >
                    <span className="text-[14px]">{badgeGlyph}</span>

                    {/* Status Badge (🥇, ✓, ★) */}
                    {isTopRecommended ? (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-[8px] text-white font-bold shadow-xs"
                        style={{ backgroundColor: '#F59E0B' }}
                      >
                        🥇
                      </span>
                    ) : isVisited ? (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-[8px] text-white font-bold shadow-xs"
                        style={{ backgroundColor: '#059669' }}
                      >
                        ✓
                      </span>
                    ) : isBookmarked ? (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-[8px] text-white font-bold shadow-xs"
                        style={{ backgroundColor: '#0284C7' }}
                      >
                        ★
                      </span>
                    ) : null}
                  </div>

                  {/* Bottom Pin Tip */}
                  <div className="w-0 h-0 mx-auto border-l-[5px] border-r-[5px] border-t-[6px] -mt-0.5 border-l-transparent border-r-transparent border-t-[#FF6B35]"></div>

                  {/* Clean Non-Intrusive Tooltip on Hover */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-stone-900/95 backdrop-blur-md text-white font-heading text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap opacity-100 transition-opacity pointer-events-none shadow-lg z-50 border border-white/15 flex items-center gap-1">
                    {isTopRecommended && <span className="text-amber-400 font-bold">🥇</span>}
                    <span>{activeSelectedPlace.name}</span>
                    {isVisited ? (
                      <span className="text-emerald-400 font-bold">✓ Đã ghé</span>
                    ) : activeSelectedPlace.rating ? (
                      <span className="text-amber-400 font-medium">★ {activeSelectedPlace.rating}</span>
                    ) : null}
                  </div>
                </div>
              </Marker>
            );
          })()}
        </MapGL>
      </div>

      {/* TOP EXPLORE CONTROLS (GOOGLE MAPS STYLE SEARCH & FOOD NAVIGATION) */}
      <div className="absolute top-[calc(4.5rem+env(safe-area-inset-top,0px))] left-3.5 right-3.5 md:left-1/2 md:-translate-x-1/2 md:w-[520px] z-30 pointer-events-auto flex flex-col gap-2">
        {/* Google Maps-Style Interactive Search Bar */}
        <GoogleMapsSearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          places={allLoadedVenues}
          currentLocation={referenceLocation}
          onSelectVenue={(venue) => {
            if ('googlePlaceId' in venue || 'isPromoted' in venue) {
              onSelectPlace(venue as Place);
              setSelectedBackgroundPOI(null);
            } else {
              onSelectPlace(null);
              setSelectedBackgroundPOI(venue as UnifiedPlace);
            }
            handleFlyTo(venue.latitude, venue.longitude, 16.5);
          }}
          onSelectLocation={(coords, zoom = 15) => {
            handleFlyTo(coords.latitude, coords.longitude, zoom);
            setViewportCenter(coords);
            fetchNearbyPOIs(coords, 2500, {
              anchor: {
                latitude: coords.latitude,
                longitude: coords.longitude,
                isRealUserLocation: false,
              },
              forceRefresh: true,
            });
          }}
          onSelectCategory={(cat) => handleSelectCategoryFilter(cat as ExploreFilterCategory)}
          onOpenFilter={() => setShowFullFilterSheet(true)}
          onOpenBiteBot={onOpenBiteBot}
          onOpenTraffic={() => setShowTrafficSheet(true)}
          onOpenComparator={handleOpenComparator}
          onOpenRoulette={() => setShowRoulette(true)}
          isLoading={isLoadingPOIs}
        />

        {/* Interactive Food Intent Category Navigation Bar with Drag-to-Scroll & Pinned Filter Button */}
        <CategoryFilterBar
          chips={quickFilterChips}
          activeFilter={activeCategoryFilter}
          onSelectFilter={handleSelectCategoryFilter}
          onOpenFullFilter={() => setShowFullFilterSheet(true)}
          totalVenuesCount={allLoadedVenues.length}
        />

        {/* Dynamic FOMO Live Activity & Flash Drop Ticker */}
        <FomoLiveTicker
          places={allLoadedVenues.length > 0 ? (allLoadedVenues as Place[]) : places}
          onSelectPlaceByCoords={(lat, lng, placeId) => {
            handleFlyTo(lat, lng, 16.5);
            if (placeId) {
              const match =
                places.find((p) => p.id === placeId) ||
                allLoadedVenues.find((v: any) => v.id === placeId);
              if (match) {
                onSelectPlace(match as Place);
              }
            }
          }}
          onOpenMysteryDrop={() => setShowMysteryDrop(true)}
          className="w-full"
        />
      </div>

      {/* 3B. Floating "Khám phá quanh đây" Signature Scan Pill when user pans away */}
      {isPannedFarFromBase && !isVenueSelected && (
        <div className="absolute top-[calc(13rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-fade-in">
          <button
            type="button"
            onClick={async () => {
              setIsAreaSearching(true);
              try {
                const loaded = await loadPlacesForViewportArea(viewportCenter, Math.max(viewportRadius, 15000));
                setAreaSearchLoadedCount(loaded);
                setTimeout(() => setAreaSearchLoadedCount(null), 3500);
              } finally {
                setIsAreaSearching(false);
              }
            }}
            disabled={isAreaSearching || isLoadingPOIs}
            className="bg-white/96 hover:bg-white text-[#2D2926] active:scale-95 px-4 py-2 rounded-full shadow-[0_6px_24px_rgba(45,41,38,0.14)] border border-stone-200/90 font-heading text-xs font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 group"
            id="btn-load-this-area"
          >
            {isAreaSearching || isLoadingPOIs ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin"></span>
                <span className="text-stone-700">Đang quét tìm quanh đây...</span>
              </>
            ) : areaSearchLoadedCount !== null ? (
              <>
                <span className="text-emerald-600 font-bold">✓</span>
                <span className="text-emerald-700 font-semibold">Đã tìm thấy các quán ngon quanh đây</span>
              </>
            ) : (
              <>
                <span className="text-[#FF6B35] text-xs">✨</span>
                <span>Khám phá quanh đây</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 4. Empty Search/Filter State Banner */}
      {totalVisibleVenues === 0 && isFilterActive && (
        <div
          className="absolute top-[calc(13rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-30 pointer-events-auto bg-[#FDFCF8]/95 backdrop-blur-md px-5 py-4 rounded-2xl shadow-[0_8px_30px_rgba(45,41,38,0.12)] border border-[#2D2926]/10 flex flex-col items-center gap-2.5 max-w-[340px] text-center animate-fade-in"
          id="empty-filter-state-banner"
          role="status"
        >
          <span className="text-2xl">🍽️</span>
          <p className="text-xs text-[#594139] font-medium leading-relaxed">
            Không có địa điểm phù hợp trong khu vực này.
            {activeCategoryFilter !== 'ALL' && (
              <span className="block mt-1 text-[11px] text-[#8D7168]">
                Đang chọn: <strong>{CANONICAL_CATEGORIES[activeCategoryFilter]?.label || activeCategoryFilter}</strong>
              </span>
            )}
            {searchQuery.trim() && (
              <span className="block text-[11px] text-[#8D7168]">
                Từ khóa: <strong>"{searchQuery}"</strong>
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              handleSelectCategoryFilter('ALL');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-[#FF6B35] hover:bg-[#E85D2A] text-white text-xs font-heading font-bold rounded-full shadow-sm active:scale-95 transition-all cursor-pointer"
            id="btn-clear-empty-filter"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}

      {/* 4A. Pioneer Explorer Pill for Sparse / New Outer Areas (Compact, Non-intrusive & Dismissable) */}
      {totalVisibleVenues === 0 &&
        !isFilterActive &&
        !isVenueSelected &&
        !isPioneerBannerDismissed &&
        !isLoadingPOIs && (
          <div
            className="absolute bottom-24 md:bottom-22 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-stone-200/90 flex items-center gap-2 max-w-[92vw] sm:max-w-md animate-fade-in"
            id="pioneer-area-state-banner"
            role="status"
          >
            <span className="text-sm shrink-0">🧭</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-heading font-semibold text-[#2D2926] truncate">
                {nearestAvailableVenue
                  ? `Quán gần nhất: ${nearestAvailableVenue.venue.name} (${(nearestAvailableVenue.distanceMeters / 1000).toFixed(1)}km)`
                  : 'Khu vực này chưa có quán check-in'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {nearestAvailableVenue && (
                <button
                  type="button"
                  onClick={() => {
                    handleFlyTo(nearestAvailableVenue.venue.latitude, nearestAvailableVenue.venue.longitude, 16);
                  }}
                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-[#2D2926] text-[11px] font-heading font-medium rounded-full active:scale-95 transition-all cursor-pointer"
                  title="Bay đến quán gần nhất"
                >
                  Xem quán
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigateToCamera(null, { mode: 'scout', title: 'Khai phá quán mới' })}
                className="px-2.5 py-1 bg-[#FF6B35] hover:bg-[#E85D2A] text-white text-[11px] font-heading font-bold rounded-full shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                id="btn-add-pioneer-spot"
              >
                <span>+50 XP</span>
                <span className="hidden xs:inline">Thêm quán</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPioneerBannerDismissed(true)}
                className="w-5 h-5 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 text-xs transition-colors cursor-pointer ml-0.5"
                title="Đóng thông báo"
                aria-label="Đóng thông báo"
              >
                ✕
              </button>
            </div>
          </div>
        )}

      {/* 4B. Full Filter Bottom Sheet / Modal */}
      {showFullFilterSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
          onClick={() => setShowFullFilterSheet(false)}
        >
          <div
            className="bg-[#FDFCF8] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-stone-200/80 max-h-[85vh] flex flex-col gap-4 overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Tất cả bộ lọc danh mục ẩm thực"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200/60">
              <div>
                <h3 className="text-base font-heading font-bold text-[#2D2926]">Bộ lọc ẩm thực</h3>
                <p className="text-xs text-stone-500 mt-0.5">Chọn danh mục món bạn muốn khám phá</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullFilterSheet(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition-colors cursor-pointer"
                aria-label="Đóng bộ lọc"
              >
                ✕
              </button>
            </div>

            {/* Category Grid */}
            <div className="grid grid-cols-2 gap-2 overflow-y-auto no-scrollbar max-h-[50vh] pr-0.5">
              {allCategoryFilterCounts.map((chip) => {
                const isSelected = activeCategoryFilter === chip.id;
                const isDisabled = chip.count === 0 && !isSelected;
                const glyph = chip.metadata?.symbolGlyph || '🍴';
                const label = chip.label;

                return (
                  <button
                    key={chip.id}
                    type="button"
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      handleSelectCategoryFilter(chip.id);
                      setShowFullFilterSheet(false);
                    }}
                    className={`flex items-center justify-between p-3 rounded-2xl text-xs font-heading transition-all text-left ${
                      isSelected
                        ? 'bg-[#FF6B35]/10 border-2 border-[#FF6B35] text-[#EA580C] font-bold shadow-xs cursor-pointer'
                        : isDisabled
                        ? 'bg-stone-50/80 border border-dashed border-stone-200 text-stone-400 opacity-50 cursor-not-allowed select-none'
                        : 'bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-medium cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{glyph}</span>
                      <span className="truncate">{label}</span>
                    </div>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-full shrink-0 ml-1.5 ${
                        isSelected
                          ? 'bg-[#FF6B35] text-white font-semibold'
                          : isDisabled
                          ? 'bg-stone-100 text-stone-400'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer Action */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-200/60 gap-3">
              {activeCategoryFilter !== 'ALL' ? (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectCategoryFilter('ALL');
                    setShowFullFilterSheet(false);
                  }}
                  className="px-4 py-2.5 text-xs font-heading font-medium text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                >
                  Xóa bộ lọc (Xem tất cả)
                </button>
              ) : (
                <span className="text-xs text-stone-400 font-medium">Đang hiển thị tất cả quán</span>
              )}
              <button
                type="button"
                onClick={() => setShowFullFilterSheet(false)}
                className="px-5 py-2.5 bg-[#FF6B35] hover:bg-[#E85D2A] text-white text-xs font-heading font-bold rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer ml-auto"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Floating Map Controls (Quiet & Distinctive Floating Dock) */}
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 z-20 pointer-events-auto items-end">
        {/* Signature Interaction: 🎲 Hôm nay ăn gì? (Tactile, Delightful Trigger) */}
        <button
          type="button"
          onClick={() => setShowRoulette(true)}
          className="group bg-gradient-to-r from-amber-500 via-orange-500 to-[#FF6B35] hover:brightness-105 active:scale-95 text-white py-2 px-3 rounded-2xl shadow-[0_4px_18px_rgba(255,107,53,0.38)] border border-white/40 transition-all cursor-pointer flex items-center gap-1.5 select-none"
          title="Ăn gì hôm nay? (Lắc xúc xắc gợi ý quán ngon)"
          id="btn-bite-roulette"
        >
          <span className="text-base group-hover:rotate-45 transition-transform duration-300">🎲</span>
          <span className="hidden sm:inline font-heading text-xs font-bold tracking-tight">Hôm nay ăn gì?</span>
        </button>

        {/* Quiet Smart Tools Cluster (Frosted Capsule) */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_4px_20px_rgba(45,41,38,0.12)] border border-stone-200/90 p-1 flex flex-col gap-1 items-center">
          {/* 🚦 Traffic & Rain/Flood Route Navigator */}
          <button
            type="button"
            onClick={() => setShowTrafficSheet(true)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
              selectedTrafficRoute
                ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-300'
                : 'text-stone-700 hover:bg-stone-100/80 hover:text-stone-950'
            }`}
            title="Né tắc đường, mưa & cảnh báo ngập lụt"
            id="btn-traffic-smart-navigator"
            aria-label="Né tắc đường"
          >
            <span className="text-base group-hover:scale-110 transition-transform">🚦</span>
            {selectedTrafficRoute && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            )}
          </button>

          {/* ⚖️ Smart Multi-Venue Comparator */}
          <button
            type="button"
            onClick={() => handleOpenComparator()}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-700 hover:bg-stone-100/80 hover:text-stone-950 transition-all cursor-pointer group"
            title="So sánh quán & tối ưu lộ trình né kẹt xe"
            id="btn-smart-comparator"
            aria-label="So sánh quán"
          >
            <span className="text-base group-hover:scale-110 transition-transform">⚖️</span>
          </button>

          {/* 🗺️ Map Layers Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowLayerSwitcher((prev) => !prev)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                showLayerSwitcher
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-700 hover:bg-stone-100/80 hover:text-stone-950'
              }`}
              title="Lớp bản đồ"
              id="btn-map-layer-switcher"
              aria-label="Lớp bản đồ"
            >
              <span className="material-symbols-outlined text-[18px]">layers</span>
            </button>

            {/* Compact Layer Switcher Popover */}
            {showLayerSwitcher && (
              <div
                className="absolute right-12 top-1/2 -translate-y-1/2 w-60 bg-white/98 backdrop-blur-md rounded-2xl p-3 border border-stone-200/90 shadow-[0_8px_30px_rgba(45,41,38,0.18)] z-40 animate-fade-in flex flex-col gap-2"
                id="map-layer-switcher-popover"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
                  <span className="font-heading text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#FF6B35]">layers</span>
                    Lớp bản đồ
                  </span>
                  <button
                    onClick={() => setShowLayerSwitcher(false)}
                    className="text-xs text-stone-400 hover:text-stone-700 p-1 rounded-full hover:bg-stone-100 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  {/* 1. FOG OF WAR RPG MODE */}
                  <button
                    type="button"
                    onClick={() => handleSelectMapMode('fog_of_war')}
                    className={`flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                      mapMode === 'fog_of_war'
                        ? 'bg-sky-50 border border-sky-400 text-stone-900'
                        : 'bg-stone-50/70 border border-stone-100 hover:bg-stone-100 text-stone-700'
                    }`}
                    id="layer-opt-fog"
                    title="Chế độ Sương Mù Khám Phá RPG"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-950 text-sky-400 flex items-center justify-center text-sm">
                        🌫️
                      </div>
                      <div className="flex flex-col">
                        <span className="font-heading text-xs font-bold text-stone-900">Sương Mù RPG</span>
                        <span className="text-[10px] text-stone-500">Mở sáng từng góc phố</span>
                      </div>
                    </div>
                    {mapMode === 'fog_of_war' && (
                      <span className="material-symbols-outlined text-sky-600 text-[16px]">check_circle</span>
                    )}
                  </button>

                  {/* 2. STREET MODE */}
                  <button
                    type="button"
                    onClick={() => handleSelectMapMode('street')}
                    className={`flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                      mapMode === 'street'
                        ? 'bg-orange-50 border border-[#FF6B35] text-stone-900'
                        : 'bg-stone-50/70 border border-stone-100 hover:bg-stone-100 text-stone-700'
                    }`}
                    id="layer-opt-street"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100/80 flex items-center justify-center text-sm">
                        🗺️
                      </div>
                      <div className="flex flex-col">
                        <span className="font-heading text-xs font-bold text-stone-900">Đường phố</span>
                        <span className="text-[10px] text-stone-500">Bản đồ chuẩn rõ nét</span>
                      </div>
                    </div>
                    {mapMode === 'street' && (
                      <span className="material-symbols-outlined text-[#FF6B35] text-[16px]">check_circle</span>
                    )}
                  </button>

                  {/* 3. SATELLITE MODE */}
                  <button
                    type="button"
                    onClick={() => handleSelectMapMode('satellite')}
                    className={`flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                      mapMode === 'satellite'
                        ? 'bg-blue-50 border border-blue-500 text-stone-900'
                        : 'bg-stone-50/70 border border-stone-100 hover:bg-stone-100 text-stone-700'
                    }`}
                    id="layer-opt-satellite"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-sm">
                        🛰️
                      </div>
                      <div className="flex flex-col">
                        <span className="font-heading text-xs font-bold text-stone-900">Vệ tinh</span>
                        <span className="text-[10px] text-stone-500">Ảnh vệ tinh độ nét cao</span>
                      </div>
                    </div>
                    {mapMode === 'satellite' && (
                      <span className="material-symbols-outlined text-blue-600 text-[16px]">check_circle</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Re-Center GPS Button */}
        <button
          onClick={handleMyLocationClick}
          className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_4px_16px_rgba(45,41,38,0.12)] flex items-center justify-center text-stone-800 hover:bg-stone-50 border border-stone-200/90 active:scale-95 transition-all cursor-pointer"
          title={hasRealLocation ? 'Vị trí của bạn' : 'Định vị GPS'}
          id="btn-my-location"
          aria-label="Định vị GPS"
        >
          <span
            className={`material-symbols-outlined text-[19px] ${
              hasRealLocation ? 'text-[#FF6B35]' : 'text-stone-500'
            }`}
          >
            my_location
          </span>
        </button>
      </div>

      {/* Fog of War Interactive HUD Overlay */}
      {mapMode === 'fog_of_war' && !activePlace && !selectedBackgroundPOI && (
        <FogOfWarHUD
          totalVenues={allLoadedVenues.length}
          visitedCount={visitedLocations.length}
          isRadarBoosted={isRadarBoosted}
          onTriggerRadarScan={handleTriggerRadarScan}
          onExitFogMode={() => handleSelectMapMode('street')}
        />
      )}

      {/* 6a. Discovery Peek Sheet (Compact Today Corner Widget on Explore) */}
      {!activePlace && !selectedBackgroundPOI && !isRadarOpen && (
        <DiscoveryPeekSheet
          todayOpportunities={todayOpportunities}
          totalVenuesCount={allLoadedVenues.length}
          isRealUserLocation={referenceLocation.isRealUserLocation}
          isLoading={isLoadingPOIs}
          onSelectVenue={handleSelectVenueFromPeek}
        />
      )}

      {/* 6c. Bottom Opportunity Carousel (Rendered when Radar destination/tab is active) */}
      {!activePlace && !selectedBackgroundPOI && isRadarOpen && displayedOpportunities.length > 0 && (
        <div className="absolute bottom-22 left-0 right-0 z-30 pointer-events-none">
          <OpportunityCarousel
            opportunities={displayedOpportunities}
            selectedPlaceId={activePlace?.id}
            onSelectOpportunity={handleSelectOpportunity}
            onActionClick={handleOpportunityAction}
            onDismiss={() => onRadarOpenChange?.(false)}
          />
        </div>
      )}

      {/* 7. BACKGROUND EXTERNAL POI CARD (Minimal, Real Provider Data Only, No Fake Ratings/Prices) */}
      {selectedBackgroundPOI && !activePlace && (() => {
        const canonicalCat = normalizeCategory(selectedBackgroundPOI);
        const catMeta = getCategoryMetadata(canonicalCat);
        const isVisited =
          visitedPlaceIds.has(selectedBackgroundPOI.id) ||
          Boolean(selectedBackgroundPOI.providerId && visitedPlaceIds.has(selectedBackgroundPOI.providerId));
        const verifiedCount = (selectedBackgroundPOI as any).verifiedBiteCount || 0;

        const vId = selectedBackgroundPOI.id || (selectedBackgroundPOI as any).providerId || selectedBackgroundPOI.name;
        const poiHotness = hotnessSnapshot.venues[vId] || calculateVenueHotness(selectedBackgroundPOI, hotnessSnapshot.calculatedAt);

        return (
          <div
            className="absolute bottom-20 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] z-40 transition-all duration-300 transform translate-y-0 pointer-events-auto"
            id="active-background-poi-card"
          >
            <div className="bg-[#FDFCF8] rounded-2xl shadow-[0_-4px_24px_rgba(45,41,38,0.18)] border border-[#2D2926]/10 overflow-hidden flex flex-col max-h-[50vh] sm:max-h-[460px]">
              {/* Header with Title and Close Button */}
              <div className="p-3 bg-white border-b border-[#2D2926]/5 flex items-start justify-between gap-2 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span
                      className="font-heading text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border shrink-0"
                      style={{
                        backgroundColor: catMeta.bgColor,
                        color: catMeta.textColor,
                        borderColor: catMeta.borderColor,
                      }}
                    >
                      <span>{catMeta.symbolGlyph}</span>
                      <span>{catMeta.label}</span>
                    </span>

                    {isVisited ? (
                      <span className="bg-[#D1FAE5] text-[#065F46] border border-[#10B981] font-heading text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>✅</span>
                        <span>Đã ghé thăm</span>
                      </span>
                    ) : poiHotness.isHot ? (
                      <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-heading text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                        <span>🔥</span>
                        <span>{poiHotness.badgeLabel || 'Đang Hot (24h)'}</span>
                      </span>
                    ) : (
                      <span className="bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7] font-heading text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>🔍 Chưa khám phá (+50 XP)</span>
                      </span>
                    )}
                  </div>
                  <h2 className="font-heading text-base font-bold text-[#2D2926] leading-tight truncate">
                    {selectedBackgroundPOI.name}
                  </h2>
                  <p className="text-[11px] text-[#594139] truncate mt-0.5">
                    {selectedBackgroundPOI.address}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBackgroundPOI(null)}
                  className="w-7 h-7 bg-[#F4F4F0] hover:bg-[#EAEAE6] rounded-full flex items-center justify-center text-[#2D2926] transition-all cursor-pointer shrink-0 active:scale-90"
                  id="btn-close-poi-card"
                  title="Đóng"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              {/* Body */}
              <div className="p-3 overflow-y-auto space-y-2 text-xs">
                {/* 24h Hotness Media / Rating Spotlight */}
                {poiHotness.isHot && !isVisited && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200/80 rounded-xl p-2 flex items-center justify-between text-[11px] text-orange-950 font-medium">
                    <span className="flex items-center gap-1 truncate">
                      <span>🔥</span>
                      <strong className="text-orange-900 truncate">
                        {poiHotness.pressMention ? `"${poiHotness.pressMention.headline}"` : (poiHotness.reasons[0] || 'Xu hướng ẩm thực')}
                      </strong>
                    </span>
                    {poiHotness.pressMention && (
                      <span className="text-[10px] text-orange-700 bg-white/80 px-1.5 py-0.2 rounded border border-orange-200 shrink-0 ml-1">
                        {poiHotness.pressMention.source}
                      </span>
                    )}
                  </div>
                )}

                {/* Distance & Info */}
                <div className="flex items-center justify-between text-[11px] text-[#594139] bg-[#FAF9F5] p-2 rounded-xl border border-[#2D2926]/5">
                  <div className="flex items-center gap-1 font-heading font-bold text-[#2D2926]">
                    <span className="material-symbols-outlined text-[#FF6B35] text-[15px]">near_me</span>
                    <span>
                      {selectedPOIDistanceM !== null
                        ? selectedPOIDistanceM < 1000
                          ? `${selectedPOIDistanceM}m`
                          : `${(selectedPOIDistanceM / 1000).toFixed(1)}km`
                        : selectedBackgroundPOI.district || 'Gần bạn'}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-[#594139]/80 font-medium truncate">
                    {isVisited ? 'Đã lưu trong lịch sử' : 'Check-in để tích XP & mở sương mù'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-2.5 bg-white border-t border-[#2D2926]/5 flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    onNavigateToCamera({
                      id: selectedBackgroundPOI.id,
                      name: selectedBackgroundPOI.name,
                      category: (selectedBackgroundPOI.category as any) || 'street_food',
                      categoryLabel: catMeta.label || selectedBackgroundPOI.categoryLabel || 'Ẩm thực',
                      address: selectedBackgroundPOI.address,
                      district: selectedBackgroundPOI.district || 'Cầu Giấy',
                      latitude: selectedBackgroundPOI.latitude,
                      longitude: selectedBackgroundPOI.longitude,
                      priceBand: '',
                      priceMin: 0,
                      priceMax: 0,
                      rating: 0,
                      reviewCount: 0,
                      imageUrl: '',
                      isOpen: true,
                      openingHoursText: '',
                    });
                  }}
                  className="flex-1 h-9 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-xl font-heading text-xs font-bold shadow-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                  id="btn-poi-capture-bite"
                >
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  <span>{isVisited ? 'Chụp Bite 📸' : 'Chụp check-in (+50 XP)'}</span>
                </button>

                <button
                  onClick={() => {
                    const googlePlaceId =
                      (selectedBackgroundPOI as any).googlePlaceId ||
                      (selectedBackgroundPOI.providerId?.startsWith('ChIJ')
                        ? selectedBackgroundPOI.providerId
                        : undefined);

                    const googleMapsUrl = buildGoogleMapsDirectionsUrl({
                      name: selectedBackgroundPOI.name,
                      address: selectedBackgroundPOI.address,
                      latitude: selectedBackgroundPOI.latitude,
                      longitude: selectedBackgroundPOI.longitude,
                      googlePlaceId,
                    });
                    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="px-2.5 bg-white border border-[#2D2926]/10 hover:bg-[#F4F4F0] text-[#2D2926] h-9 rounded-xl font-heading text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer shrink-0"
                  title="Chỉ đường"
                  id="btn-poi-directions"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#FF6B35]">directions</span>
                  <span className="hidden sm:inline">Chỉ đường</span>
                </button>

                <button
                  onClick={() => {
                    handleOpenComparator([selectedBackgroundPOI]);
                  }}
                  className="px-2.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 h-9 rounded-xl font-heading text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer shrink-0"
                  title="So sánh với quán khác"
                  id="btn-poi-compare"
                >
                  <span>⚖️</span>
                  <span>So sánh</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 8. PROMOTED BITEQUEST PLACE CARD V2 (When a BiteQuest place is selected) */}
      {activePlace && (() => {
        const isPlaceVisited =
          visitedPlaceIds.has(activePlace.id) ||
          Boolean(activePlace.providerPlaceId && visitedPlaceIds.has(activePlace.providerPlaceId));

        const hasRealCommunityProof =
          (activePlace.verifiedBiteCount && activePlace.verifiedBiteCount > 0) ||
          (activePlace.friendsVisited && activePlace.friendsVisited.length > 0) ||
          Boolean(activePlace.communityVerified);

        const vId = activePlace.id || (activePlace as any).providerPlaceId || activePlace.name;
        const placeHotness = hotnessSnapshot.venues[vId] || calculateVenueHotness(activePlace, hotnessSnapshot.calculatedAt);

        return (
          <div
            className="absolute bottom-20 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] z-40 transition-all duration-300 transform translate-y-0 pointer-events-auto"
            id="active-restaurant-card-v2"
          >
            <div className="bg-[#FDFCF8] rounded-2xl shadow-[0_-4px_28px_rgba(45,41,38,0.18)] border border-[#2D2926]/10 overflow-hidden flex flex-col max-h-[52vh] sm:max-h-[480px]">
              {/* Card Header Image - Sleek banner */}
              <div className="h-20 sm:h-24 w-full relative shrink-0">
                <img
                  src={activePlace.imageUrl}
                  alt={activePlace.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlace(null);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all cursor-pointer z-20 active:scale-90"
                  title="Đóng"
                  id="btn-close-place-card"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>

                {/* Bookmark Save button */}
                <button
                  onClick={() => onSavePlaceToggle(activePlace.id)}
                  className={`absolute top-2 right-10 w-7 h-7 rounded-full flex items-center justify-center shadow-xs transition-transform active:scale-90 ${
                    isSaved ? 'bg-[#00A7CB] text-white' : 'bg-white/90 text-[#2D2926]'
                  }`}
                  title="Lưu quán"
                >
                  <span className="material-symbols-outlined text-[16px] fill">bookmark</span>
                </button>

                {/* Opportunity Type / Visited Pill on Image */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1 flex-wrap">
                  {isPlaceVisited ? (
                    <span className="bg-[#10B981] text-white font-heading text-[10px] font-bold px-2 py-0.2 rounded-full shadow-2xs flex items-center gap-0.5">
                      <span>✓ Đã chinh phục</span>
                    </span>
                  ) : placeHotness.isHot ? (
                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-heading text-[10px] font-bold px-2 py-0.2 rounded-full shadow-2xs flex items-center gap-0.5">
                      <span>🔥 {placeHotness.badgeLabel || 'Hot 24h'}</span>
                    </span>
                  ) : (
                    <span className="bg-black/60 backdrop-blur-md text-white font-heading text-[10px] font-medium px-2 py-0.2 rounded-full border border-white/20 flex items-center gap-0.5">
                      <span>🔍 +50 XP</span>
                    </span>
                  )}

                  {activeOpportunity?.type === 'SCOUT_WINDOW' && !isPlaceVisited && (
                    <span className="bg-[#2EC4B6] text-white font-heading text-[10px] font-bold px-2 py-0.2 rounded-full shadow-2xs">
                      🥇 First Verifier
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body with smooth internal scroll if content exceeds max-height */}
              <div className="p-3 flex flex-col gap-2 overflow-y-auto">
                {/* Title & Basic Meta */}
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h2 className="font-heading text-base font-bold text-[#2D2926] leading-tight truncate">
                      {activePlace.name}
                    </h2>
                    {hasRealCommunityProof ? (
                      <div className="flex items-center gap-1 bg-[#F4F4F0] px-1.5 py-0.5 rounded-md shrink-0" title="Đánh giá">
                        <span className="material-symbols-outlined text-[#FF6B35] text-[13px] fill">star</span>
                        <span className="font-heading text-xs font-bold text-[#2D2926]">
                          {activePlace.rating || '4.5'}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <p className="text-[11px] text-[#594139] flex items-center gap-1.5 font-medium mt-0.5">
                    <span>{activePlace.categoryLabel || activePlace.district}</span>
                    <span className="w-1 h-1 bg-[#8D7168]/40 rounded-full"></span>
                    <span>{activePlace.priceBand || '35k–55k'}</span>
                    <span className="w-1 h-1 bg-[#8D7168]/40 rounded-full"></span>
                    <span className="text-[#006A62] font-semibold">
                      {activePlace.isOpen ? 'Đang mở cửa' : 'Đóng cửa'}
                    </span>
                  </p>
                </div>

                {/* 24h Hotness / Press compact line */}
                {placeHotness.isHot && !isPlaceVisited && placeHotness.pressMention && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200/70 rounded-xl p-1.5 text-[11px] text-orange-950 flex items-center justify-between gap-1">
                    <span className="truncate">
                      <strong>📰 {placeHotness.pressMention.source}:</strong> <span className="italic">"{placeHotness.pressMention.headline}"</span>
                    </span>
                  </div>
                )}

                {/* Distance & Address */}
                <div className="flex items-center justify-between text-[11px] text-[#594139] bg-[#FAF9F5] p-2 rounded-xl border border-[#2D2926]/5">
                  <div className="flex items-center gap-1 font-heading font-bold text-[#2D2926]">
                    <span className="material-symbols-outlined text-[#FF6B35] text-[15px]">near_me</span>
                    <span>{formattedDistance}</span>
                  </div>
                  <span className="text-[10.5px] truncate max-w-[220px] text-[#594139]">
                    {activePlace.address}
                  </span>
                </div>
              </div>

              {/* Compact Dynamic Action Bar */}
              <div className="p-2.5 bg-white border-t border-[#2D2926]/5 flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (activeOpportunity) {
                      handleOpportunityAction(activeOpportunity);
                    } else {
                      onNavigateToCamera(activePlace);
                    }
                  }}
                  className={`flex-1 h-9 rounded-xl font-heading text-xs font-bold shadow-xs flex items-center justify-center gap-1 active:scale-95 transition-all text-white cursor-pointer ${
                    activeOpportunity?.type === 'SCOUT_WINDOW'
                      ? 'bg-[#2EC4B6] hover:bg-[#2EC4B6]/90'
                      : activeOpportunity?.type === 'QUEST_MATCH'
                      ? 'bg-[#FF9F1C] hover:bg-[#FF9F1C]/90 text-[#2D2926]'
                      : 'bg-[#FF6B35] hover:bg-[#FF6B35]/90'
                  }`}
                  id="btn-smart-cta"
                >
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  <span>{isPlaceVisited ? 'Chụp thêm 📸' : 'Chụp check-in (+50 XP)'}</span>
                </button>

                {/* External Directions */}
                <button
                  onClick={() => {
                    const googlePlaceId =
                      activePlace.googlePlaceId ||
                      (activePlace.providerPlaceId?.startsWith('ChIJ')
                        ? activePlace.providerPlaceId
                        : undefined);

                    const googleMapsUrl = buildGoogleMapsDirectionsUrl({
                      name: activePlace.name,
                      address: activePlace.address,
                      latitude: activePlace.latitude,
                      longitude: activePlace.longitude,
                      googlePlaceId,
                    });
                    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="px-2.5 bg-white border border-[#2D2926]/10 hover:bg-[#F4F4F0] text-[#2D2926] h-9 rounded-xl font-heading text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer shrink-0"
                  title="Chỉ đường"
                  id="btn-directions"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#FF6B35]">directions</span>
                  <span className="hidden sm:inline">Chỉ đường</span>
                </button>

                {/* Smart Compare Button */}
                <button
                  onClick={() => {
                    handleOpenComparator([activePlace]);
                  }}
                  className="px-2.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 h-9 rounded-xl font-heading text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer shrink-0"
                  title="So sánh với quán khác"
                  id="btn-place-compare"
                >
                  <span>⚖️</span>
                  <span>So sánh</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 8. Active Traffic-Smart Route Navigation Card (When a smart traffic route is selected) */}
      {selectedTrafficRoute && !activePlace && (
        <div className="absolute bottom-20 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[490px] z-30 pointer-events-auto animate-fade-in">
          <div className="bg-[#1C1917]/95 backdrop-blur-md text-white rounded-2xl p-3.5 border border-emerald-500/40 shadow-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold shrink-0 text-white ${
                    selectedTrafficRoute.weatherFlood && (selectedTrafficRoute.weatherFlood.routeFloodRisk === 'high_flood' || selectedTrafficRoute.weatherFlood.routeFloodRisk === 'moderate')
                      ? 'bg-rose-600 shadow-md shadow-rose-600/30'
                      : selectedTrafficRoute.trafficLevel === 'smooth'
                      ? 'bg-emerald-500 shadow-md shadow-emerald-500/30'
                      : selectedTrafficRoute.trafficLevel === 'moderate'
                      ? 'bg-amber-500 shadow-md shadow-amber-500/30'
                      : 'bg-red-500 shadow-md shadow-red-500/30'
                  }`}
                >
                  {selectedTrafficRoute.weatherFlood?.weather?.isRainy ? '🌧️' : '🚦'}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong className="text-xs font-bold text-white truncate">
                      {selectedTrafficRoute.place?.name}
                    </strong>
                    <span
                      className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold border ${
                        selectedTrafficRoute.trafficLevel === 'smooth'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : selectedTrafficRoute.trafficLevel === 'moderate'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-red-500/20 text-red-300 border-red-500/40'
                      }`}
                    >
                      {selectedTrafficRoute.trafficLabel}
                    </span>
                    {selectedTrafficRoute.weatherFlood?.weather && (
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold">
                        {selectedTrafficRoute.weatherFlood.weather.conditionIcon} {selectedTrafficRoute.weatherFlood.weather.temperatureC}°C
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-stone-300 truncate">
                    {selectedTrafficRoute.distanceKmFormatted} • ~{selectedTrafficRoute.estimatedDurationMinutes} phút • {selectedTrafficRoute.smartAdvice}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTrafficRoute(null)}
                className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs cursor-pointer shrink-0 transition-colors"
                title="Tắt lộ trình"
              >
                ✕
              </button>
            </div>

            {/* Weather & Flood Alert if any */}
            {selectedTrafficRoute.weatherFlood && selectedTrafficRoute.weatherFlood.detectedFloodSpots.length > 0 && (
              <div className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-[10.5px] text-rose-200 flex items-center gap-1.5">
                <span>⚠️</span>
                <span className="truncate">
                  Điểm đen ngập: <strong>{selectedTrafficRoute.weatherFlood.detectedFloodSpots[0].name}</strong> ({selectedTrafficRoute.weatherFlood.detectedFloodSpots[0].safeDetourAdvice})
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-[11px]">
              <span className="text-emerald-400 font-medium truncate mr-2">
                💡 {selectedTrafficRoute.bestDepartureTimeAdvice}
              </span>
              <button
                type="button"
                onClick={() => setShowTrafficSheet(true)}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shrink-0"
              >
                Đổi giờ / Quán khác
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MapLibre OpenFreeMap & OpenStreetMap Proper Attribution */}
      <div
        className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-2 z-20 px-2 py-0.5 rounded bg-[#FAF9F5]/90 backdrop-blur-xs border border-[#2D2926]/10 text-[10px] text-[#8D7168] pointer-events-auto select-none flex items-center gap-1.5 shadow-xs"
        id="map-attribution-watermark"
      >
        <span className="font-heading font-semibold text-[#594139]">BiteQuest Map</span>
        <span>•</span>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline hover:text-[#FF6B35]"
        >
          © OpenStreetMap
        </a>
        <span>•</span>
        {mapMode === 'satellite' ? (
          <a
            href="https://www.esri.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-[#FF6B35]"
          >
            © Esri, Maxar, Earthstar Geographics
          </a>
        ) : isStyleFallbackActive ? (
          <a
            href="https://carto.com/attributions"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-[#FF6B35]"
          >
            © CARTO (Fallback)
          </a>
        ) : (
          <a
            href="https://openfreemap.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-[#FF6B35]"
          >
            © OpenFreeMap
          </a>
        )}
      </div>
      {/* 10. Mystery Drop Gamified Reveal Modal */}
      <MysteryDropModal
        isOpen={showMysteryDrop}
        onClose={() => setShowMysteryDrop(false)}
        nearbyPlaces={allLoadedVenues.length > 0 ? (allLoadedVenues as Place[]) : places}
        onNavigateToPlace={(p) => {
          handleFlyTo(p.latitude, p.longitude, 16.5);
          onSelectPlace(p);
        }}
      />

      {/* 11. Bite Roulette Spin-the-Wheel Modal */}
      <BiteRouletteModal
        isOpen={showRoulette}
        onClose={() => setShowRoulette(false)}
        places={allLoadedVenues.length > 0 ? (allLoadedVenues as Place[]) : places}
        savedPlaceIds={savedPlaceIds}
        userLocation={referenceLocation}
        onSelectPlace={(p) => {
          handleFlyTo(p.latitude, p.longitude, 16.5);
          onSelectPlace(p);
        }}
      />

      {/* 12. 🚦 Smart Traffic & Peak-Hour Congestion Navigator Sheet */}
      <TrafficSmartNavigatorSheet
        isOpen={showTrafficSheet}
        onClose={() => setShowTrafficSheet(false)}
        places={allLoadedVenues.length > 0 ? (allLoadedVenues as Place[]) : places}
        userLocation={referenceLocation}
        selectedRouteResult={selectedTrafficRoute}
        onOpenComparator={(initials) => {
          setShowTrafficSheet(false);
          handleOpenComparator(initials);
        }}
        onSelectRoute={(route) => {
          setSelectedTrafficRoute(route);
          if (route.place) {
            handleFlyTo(route.place.latitude, route.place.longitude, 15.5);
            onSelectPlace(route.place);
          }
        }}
      />

      {/* 13. ⚖️ Smart Multi-Venue & Route Comparator Modal */}
      <SmartVenueComparatorModal
        isOpen={showComparatorModal}
        onClose={() => setShowComparatorModal(false)}
        places={allLoadedVenues.length > 0 ? allLoadedVenues : places}
        userLocation={referenceLocation}
        initialSelectedVenues={comparatorInitialVenues}
        onSelectDestination={(venue, route) => {
          setShowComparatorModal(false);
          if (route) {
            setSelectedTrafficRoute(route);
          }
          if ('googlePlaceId' in venue || 'isPromoted' in venue) {
            onSelectPlace(venue as Place);
            setSelectedBackgroundPOI(null);
          } else {
            onSelectPlace(null);
            setSelectedBackgroundPOI(venue as UnifiedPlace);
          }
          handleFlyTo(venue.latitude, venue.longitude, 16.5);
        }}
      />
    </div>
  );
};
