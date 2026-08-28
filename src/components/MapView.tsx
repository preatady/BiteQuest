import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import MapGL, { Marker, NavigationControl, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getDistance } from 'geolib';
import { Place, BiteCheckin, DistrictPassport, User, BiteOpportunity } from '../types';
import { UnifiedPlace } from '../services/maps/types';
import {
  getMapLibreConfig,
  MapMode,
  OPENFREEMAP_LIBERTY_STYLE,
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
  scanRenderedMapPlaces,
  convertVectorFeatureToPlace,
  isFoodOrVenueFeature,
} from '../services/maps/vectorTileScanner';

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
}

export type ExploreMode = 'radar' | 'friends' | 'quest';

// MapLibre native clustering layer definitions for background F&B POIs (Neutral map-compatible stone styling)
const clusterLayer: any = {
  id: 'clusters',
  type: 'circle',
  source: 'background-pois',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step',
      ['get', 'point_count'],
      '#57534E', // neutral stone-600
      6,
      '#44403C', // neutral stone-700
      15,
      '#292524', // neutral stone-800
    ],
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      14,
      6,
      18,
      15,
      22,
    ],
    'circle-stroke-width': 2.5,
    'circle-stroke-color': '#FFFFFF',
    'circle-opacity': 0.92,
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
    'text-size': 11,
  },
  paint: {
    'text-color': '#FFFFFF',
  },
};

// Medium/Close Zoom category icon symbol layer with collision detection
const unclusteredCategoryIconLayer: any = {
  id: 'unclustered-category-icon',
  type: 'symbol',
  source: 'background-pois',
  filter: ['!', ['has', 'point_count']],
  minzoom: 11.5,
  layout: {
    'icon-image': ['coalesce', ['get', 'iconName'], 'icon-other_food-unvisited'],
    'icon-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      11.5,
      0.65,
      13,
      0.8,
      15,
      0.95,
      17,
      1.05,
    ],
    'icon-allow-overlap': false,
    'icon-ignore-placement': false,
    'icon-padding': 1.5,
  },
};

// Ambient Venue Name Label Layer (Consumer map style, zoom-scaled with collision handling)
const ambientVenueLabelLayer: any = {
  id: 'ambient-venue-labels',
  type: 'symbol',
  source: 'background-pois',
  filter: ['!', ['has', 'point_count']],
  minzoom: 12.5,
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      12.5,
      9.5,
      14,
      10.5,
      15,
      12,
      17,
      13,
    ],
    'text-offset': [0, 1.25],
    'text-anchor': 'top',
    'text-max-width': 9.5,
    'text-padding': 2,
    'text-optional': true,
    'text-allow-overlap': false,
    'text-ignore-placement': false,
  },
  paint: {
    'text-color': [
      'case',
      ['==', ['get', 'isVisited'], 1],
      '#0F172A',
      '#57534E',
    ],
    'text-halo-color': '#FFFFFF',
    'text-halo-width': 2.5,
    'text-halo-blur': 0.5,
    'text-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      12.5,
      0.75,
      14,
      0.9,
      15,
      1.0,
    ],
  },
};

// Far zoom subtle dot layer when zoom < 12.5
const unclusteredFarCircleLayer: any = {
  id: 'unclustered-far-circle',
  type: 'circle',
  source: 'background-pois',
  filter: ['!', ['has', 'point_count']],
  maxzoom: 12.5,
  paint: {
    'circle-color': ['get', 'color'],
    'circle-radius': 3.5,
    'circle-stroke-width': 1,
    'circle-stroke-color': '#FFFFFF',
    'circle-opacity': 0.75,
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
}) => {
  const [exploreMode, setExploreMode] = useState<ExploreMode>('radar');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<ExploreFilterCategory>('ALL');
  const [, setMapLoadError] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>(() => {
    try {
      const saved = localStorage.getItem('bitequest_map_mode');
      if (saved === 'satellite') return 'satellite';
    } catch {
      // ignore
    }
    return 'street';
  });
  const [showLayerSwitcher, setShowLayerSwitcher] = useState(false);
  const mapRef = useRef<MapRef | null>(null);

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
    fetchNearbyPOIs,
    addDiscoveredPOIs,
  } = useExploreNearbyPlaces();
  const [selectedBackgroundPOI, setSelectedBackgroundPOI] = useState<UnifiedPlace | null>(null);
  const [viewportCenter, setViewportCenter] = useState<{ latitude: number; longitude: number }>(FALLBACK_CENTER);
  const [viewportRadius, setViewportRadius] = useState<number>(2500);
  const [isPioneerBannerDismissed, setIsPioneerBannerDismissed] = useState<boolean>(false);
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

  // Request real browser geolocation on initial mount (ONE-SHOT)
  useEffect(() => {
    if (initialGeolocatedRef.current) return;
    initialGeolocatedRef.current = true;

    // Immediately fetch default / fallback center so the map is NEVER blank while GPS is resolving
    fetchNearbyPOIs(FALLBACK_CENTER, 2000, {
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
          fetchNearbyPOIs(coords, 2000, {
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
  }, [fetchNearbyPOIs]);

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

  // Deduplicate live Geoapify POIs against BiteQuest verified / promoted places
  const unpromotedNearbyPOIs = useMemo(() => {
    return nearbyPOIs.filter((poi) => {
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
  }, [nearbyPOIs, places]);

  // Promoted community places across the entire map
  const localPromotedPlaces = useMemo(() => {
    return places.filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number');
  }, [places]);

  // Dynamic filter chips derived strictly from all venues in current map area
  const allLoadedVenues = useMemo(() => {
    return [...localPromotedPlaces, ...unpromotedNearbyPOIs];
  }, [localPromotedPlaces, unpromotedNearbyPOIs]);

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

  const todayResult = useMemo(() => {
    return adaptBiteOpportunities(radarOpportunities, {
      userPreferences: user?.foodPreferences,
      isRealUserLocation: referenceLocation.isRealUserLocation,
      visitedPlaceIds,
      maxLimit: 3,
    });
  }, [radarOpportunities, user?.foodPreferences, referenceLocation.isRealUserLocation, visitedPlaceIds]);

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

        const iconName = isVisited
          ? `icon-${canonicalCat.toLowerCase()}-visited`
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
            color: isVisited ? '#10B981' : '#78716C',
            address: poi.address,
            district: poi.district,
            city: poi.city || 'Hà Nội',
            distanceMeters: poi.distanceMeters,
            verifiedBiteCount: (poi as any).verifiedBiteCount || 0,
          },
        };
      }),
    };
  }, [filteredUnpromotedNearbyPOIs, visitedPlaceIds]);

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

  const activePlace = selectedPlace;
  const activeOpportunity = activePlace ? opportunityMap.get(activePlace.id) : null;
  const isSaved = activePlace ? savedPlaceIds.includes(activePlace.id) : false;

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
      layers: ['clusters', 'unclustered-category-icon', 'ambient-venue-labels', 'unclustered-far-circle'],
    });

    if (features && features.length > 0) {
      const feature = features[0];
      if (feature.layer.id === 'clusters') {
        const clusterId = feature.properties?.cluster_id;
        const source = map.getSource('background-pois') as any;
        if (source && clusterId !== undefined) {
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return;
            map.easeTo({
              center: (feature.geometry as any).coordinates,
              zoom: Math.min(zoom + 0.8, 17),
              duration: 500,
            });
          });
        }
        return;
      }

      if (
        feature.layer.id === 'unclustered-category-icon' ||
        feature.layer.id === 'ambient-venue-labels' ||
        feature.layer.id === 'unclustered-far-circle'
      ) {
        const poiId = feature.properties?.id;
        const poi = nearbyPOIs.find((p) => p.id === poiId);
        if (poi) {
          onSelectPlace(null);
          setSelectedBackgroundPOI(poi);
          handleFlyTo(poi.latitude, poi.longitude);
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
  }, [nearbyPOIs, referenceLocation, onSelectPlace, addDiscoveredPOIs]);

  // Scan vector map tiles whenever map finishes rendering to promote all OSM POIs across Vietnam
  const scanMapTiles = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const vectorPlaces = scanRenderedMapPlaces(map, referenceLocation);
    if (vectorPlaces.length > 0) {
      addDiscoveredPOIs(vectorPlaces);
    }
  }, [referenceLocation, addDiscoveredPOIs]);

  // Viewport tracking & smooth silent ambient loading when panning to new areas
  const handleMapMoveEnd = useCallback(
    (e: any) => {
      const center = e.target.getCenter();
      const newCenter = { latitude: center.lat, longitude: center.lng };
      setViewportCenter(newCenter);
      const newRadius = calculateViewportRadius();
      setViewportRadius(newRadius);

      // Immediately scan visible vector tiles in new viewport
      scanMapTiles();

      if (moveEndDebounceRef.current) {
        clearTimeout(moveEndDebounceRef.current);
      }

      moveEndDebounceRef.current = setTimeout(() => {
        const dist = lastFetchedCenter ? getDistance(lastFetchedCenter, newCenter) : Infinity;
        if (dist > 250) {
          fetchNearbyPOIs(newCenter, newRadius, {
            anchor: {
              latitude: referenceLocation.latitude,
              longitude: referenceLocation.longitude,
              isRealUserLocation: hasRealLocation,
            },
          });
        }
      }, 250);
    },
    [calculateViewportRadius, lastFetchedCenter, referenceLocation, hasRealLocation, fetchNearbyPOIs, scanMapTiles]
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
      handleFlyTo(userLocation.latitude, userLocation.longitude);
      fetchNearbyPOIs(userLocation, 2000, {
        anchor: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          isRealUserLocation: true,
        },
      });
    } else if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserLocation(coords);
          setHasRealLocation(true);
          setIsLocating(false);
          handleFlyTo(coords.latitude, coords.longitude);
          fetchNearbyPOIs(coords, 2000, {
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
          handleFlyTo(FALLBACK_CENTER.latitude, FALLBACK_CENTER.longitude);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      handleFlyTo(FALLBACK_CENTER.latitude, FALLBACK_CENTER.longitude);
    }
  };

  const activeMapStyle = useMemo(() => {
    return getMapStyleForMode(mapMode);
  }, [mapMode]);

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
          interactiveLayerIds={['clusters', 'unclustered-category-icon', 'ambient-venue-labels', 'unclustered-far-circle']}
          onClick={handleMapClick}
          onMoveEnd={handleMapMoveEnd}
          onIdle={scanMapTiles}
          onError={(event: any) => {
            const errorObj = event?.error || {};
            const errorMsg =
              typeof errorObj === 'string'
                ? errorObj
                : (errorObj as any)?.message ||
                  (typeof event?.message === 'string' ? event.message : '') ||
                  (typeof event?.status === 'number' ? `HTTP ${event.status}` : 'MapLibre event');
            console.warn('[MapLibre Event]', errorMsg);
          }}
          onLoad={(e) => {
            setMapLoadError(false);
            const map = e.target;
            setupMapIconLifecycle(map);
            map.resize();
          }}
        >
          {/* Top-right Navigation Controls positioned safely below top bar */}
          <div className="absolute top-32 right-3 z-20 pointer-events-auto">
            <NavigationControl position="top-right" showCompass={false} />
          </div>

          {/* Background Clustered POI GeoJSON Layer */}
          <Source
            id="background-pois"
            type="geojson"
            data={backgroundPOIGeoJSON}
            cluster={true}
            clusterMaxZoom={12}
            clusterRadius={38}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...unclusteredFarCircleLayer} />
            <Layer {...unclusteredCategoryIconLayer} />
            <Layer {...ambientVenueLabelLayer} />
          </Source>

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

          {/* Promoted BiteQuest Layer Markers (Radar / Friends / Quest with Non-Destructive Priority) */}
          {filteredPlaces.map((place) => {
            const isSelected = activePlace?.id === place.id;
            const opp = opportunityMap.get(place.id);
            const isBookmarked = savedPlaceIds.includes(place.id);
            const isVisited =
              visitedPlaceIds.has(place.id) ||
              Boolean(place.providerPlaceId && visitedPlaceIds.has(place.providerPlaceId)) ||
              Boolean(place.googlePlaceId && visitedPlaceIds.has(place.googlePlaceId));

            // Only show authentic review badge if verified bites or actual visits exist
            const hasCommunityProof =
              (place.verifiedBiteCount && place.verifiedBiteCount > 0) ||
              (place.friendsVisited && place.friendsVisited.length > 0) ||
              Boolean(place.communityVerified);

            const isScout = opp?.type === 'SCOUT_WINDOW';
            const isQuest = opp?.type === 'QUEST_MATCH';
            const isFriendEcho = opp?.type === 'FRIEND_ECHO' && Boolean(opp.friendActivity);

            const isFriendActive = isFriendEcho || (place.friendsVisited && place.friendsVisited.length > 0);
            const isQuestActive = isQuest || isScout;
            const isDimmedInMode =
              (exploreMode === 'friends' && !isFriendActive) ||
              (exploreMode === 'quest' && !isQuestActive);

            return (
              <Marker
                key={place.id}
                longitude={place.longitude}
                latitude={place.latitude}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedBackgroundPOI(null);
                  onSelectPlace(place);
                  handleFlyTo(place.latitude, place.longitude);
                }}
              >
                <div
                  className={`relative group cursor-pointer transform hover:scale-110 active:scale-95 transition-all ${
                    isDimmedInMode ? 'opacity-40 scale-85 z-10' : 'opacity-100 z-20'
                  }`}
                  id={`marker-promoted-${place.id}`}
                >
                  {/* Authentic Community Review Indicator - ONLY shown when real check-ins/reviews exist */}
                  {hasCommunityProof && !isSelected && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#10B981] text-white text-[9.5px] font-heading font-semibold shadow-[0_2px_8px_rgba(16,185,129,0.35)] whitespace-nowrap flex items-center gap-1 border border-white/90 animate-fade-in pointer-events-none z-30">
                      <span className="text-[9px]">⭐</span>
                      <span>Đã có review</span>
                    </div>
                  )}

                  {/* Outer Pulsing Opportunity Ring */}
                  {isScout && (
                    <div className="absolute -inset-2 rounded-full bg-[#2EC4B6]/30 animate-ping pointer-events-none"></div>
                  )}
                  {isQuest && (
                    <div className="absolute -inset-2 rounded-full bg-[#FF9F1C]/30 animate-ping pointer-events-none"></div>
                  )}

                  {/* Marker Pin Head - Dimmed/Gray for unvisited, Vibrant + Checkmark for visited */}
                  <div
                    className={`relative flex items-center justify-center rounded-full border-2 transition-all shadow-md ${
                      isSelected
                        ? 'w-10 h-10 bg-[#FF6B35] border-white scale-110 shadow-lg text-white'
                        : isVisited
                        ? 'w-9 h-9 bg-[#FF6B35] border-white ring-2 ring-[#10B981]/30 shadow-md text-white'
                        : isScout
                        ? 'w-9 h-9 bg-[#2EC4B6] border-white text-white'
                        : isQuest
                        ? 'w-9 h-9 bg-[#FF9F1C] border-[#2D2926] text-[#2D2926]'
                        : isFriendEcho
                        ? 'w-9 h-9 bg-[#FF6B35] border-white text-white'
                        : 'w-8 h-8 bg-[#78716C] border-[#D6D3D1] text-white/90 shadow-sm opacity-90'
                    }`}
                  >
                    <span className="text-sm">
                      {isScout ? '🥇' : isQuest ? '🗺️' : isFriendEcho ? '👥' : CANONICAL_CATEGORIES[normalizeCategory(place)]?.symbolGlyph || '🍴'}
                    </span>

                    {/* Visited Checkmark Badge */}
                    {isVisited && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#10B981] rounded-full border border-white flex items-center justify-center shadow-xs">
                        <span className="text-[9px] text-white font-bold">✓</span>
                      </div>
                    )}

                    {/* Bookmark Indicator Badge */}
                    {isBookmarked && !isVisited && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#00A7CB] rounded-full border border-white flex items-center justify-center">
                        <span className="text-[8px] text-white">★</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Pin Tip */}
                  <div
                    className={`w-0 h-0 mx-auto border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] -mt-0.5 ${
                      isSelected || isVisited
                        ? 'border-t-[#FF6B35]'
                        : isScout
                        ? 'border-t-[#2EC4B6]'
                        : isQuest
                        ? 'border-t-[#FF9F1C]'
                        : isFriendEcho
                        ? 'border-t-[#FF6B35]'
                        : 'border-t-[#78716C]'
                    }`}
                  ></div>

                  {/* Hover Tooltip */}
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#2D2926]/90 text-white font-heading text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow z-40">
                    {place.name} {isVisited ? '• Đã check-in ✓' : '• Chưa khám phá (+50 XP)'}
                  </div>
                </div>
              </Marker>
            );
          })}
        </MapGL>
      </div>

      {/* TOP EXPLORE CONTROLS (GOOGLE MAPS STYLE SEARCH & FOOD NAVIGATION) */}
      <div className="absolute top-2.5 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:w-[500px] z-30 pointer-events-auto flex flex-col gap-1.5">
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
      </div>

      {/* 4. Empty Search/Filter State Banner */}
      {totalVisibleVenues === 0 && isFilterActive && (
        <div
          className="absolute top-36 left-1/2 -translate-x-1/2 z-30 pointer-events-auto bg-[#FDFCF8]/95 backdrop-blur-md px-5 py-4 rounded-2xl shadow-[0_8px_30px_rgba(45,41,38,0.12)] border border-[#2D2926]/10 flex flex-col items-center gap-2.5 max-w-[340px] text-center animate-fade-in"
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

      {/* 5. Floating Map Controls (Layer Switcher & Re-Center) */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 z-20 pointer-events-auto items-center">
        {/* Layer Switcher Trigger Button */}
        <div className="relative">
          <button
            onClick={() => setShowLayerSwitcher((prev) => !prev)}
            className={`w-11 h-11 rounded-full shadow-[0_4px_16px_rgba(45,41,38,0.12)] flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              showLayerSwitcher
                ? 'bg-[#2D2926] text-white'
                : 'bg-white text-[#2D2926] hover:bg-[#F4F4F0]'
            }`}
            title="Lớp bản đồ"
            id="btn-map-layer-switcher"
            aria-label="Lớp bản đồ"
          >
            <span className="material-symbols-outlined text-[22px]">layers</span>
          </button>

          {/* Compact Layer Switcher Popover */}
          {showLayerSwitcher && (
            <div
              className="absolute right-14 top-1/2 -translate-y-1/2 w-64 bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-[#2D2926]/10 shadow-[0_8px_30px_rgba(45,41,38,0.18)] z-30 animate-fade-in flex flex-col gap-2"
              id="map-layer-switcher-popover"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-[#2D2926]/8">
                <span className="font-heading text-xs font-bold text-[#2D2926] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#FF6B35]">layers</span>
                  Lớp bản đồ
                </span>
                <button
                  onClick={() => setShowLayerSwitcher(false)}
                  className="text-xs text-[#8D7168] hover:text-[#2D2926] p-1 rounded-full hover:bg-[#F4F4F0] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                {/* 1. STREET MODE (OpenFreeMap Liberty) */}
                <button
                  type="button"
                  onClick={() => handleSelectMapMode('street')}
                  className={`flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                    mapMode === 'street'
                      ? 'bg-[#FF6B35]/10 border-2 border-[#FF6B35] text-[#2D2926]'
                      : 'bg-[#FAF9F5] border border-[#2D2926]/5 hover:bg-[#F4F4F0] text-[#594139]'
                  }`}
                  id="layer-opt-street"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100/80 flex items-center justify-center text-base">
                      🗺️
                    </div>
                    <div className="flex flex-col">
                      <span className="font-heading text-xs font-bold text-[#2D2926]">Đường phố</span>
                      <span className="text-[10px] text-[#8D7168]">OpenFreeMap Liberty</span>
                    </div>
                  </div>
                  {mapMode === 'street' && (
                    <span className="material-symbols-outlined text-[#FF6B35] text-[18px]">check_circle</span>
                  )}
                </button>

                {/* 2. SATELLITE MODE */}
                {(() => {
                  const hasToken = isEsriTokenConfigured();
                  return (
                    <button
                      type="button"
                      onClick={() => handleSelectMapMode('satellite')}
                      className={`flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                        mapMode === 'satellite'
                          ? 'bg-[#FF6B35]/10 border-2 border-[#FF6B35] text-[#2D2926]'
                          : 'bg-[#FAF9F5] border border-[#2D2926]/5 hover:bg-[#F4F4F0] text-[#594139]'
                      }`}
                      id="layer-opt-satellite"
                      title="Chuyển sang ảnh vệ tinh Esri World Imagery"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100/80 flex items-center justify-center text-base">
                          🛰️
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-heading text-xs font-bold text-[#2D2926]">Vệ tinh</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-100 text-emerald-800">
                              {hasToken ? 'Esri ArcGIS HD' : 'Esri World Imagery'}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#8D7168]">
                            Ảnh vệ tinh toàn cầu độ nét cao
                          </span>
                        </div>
                      </div>
                      {mapMode === 'satellite' && (
                        <span className="material-symbols-outlined text-[#FF6B35] text-[18px]">check_circle</span>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Re-Center GPS Button */}
        <button
          onClick={handleMyLocationClick}
          className="w-11 h-11 bg-white rounded-full shadow-[0_4px_16px_rgba(45,41,38,0.12)] flex items-center justify-center text-[#2D2926] hover:bg-[#F4F4F0] active:scale-95 transition-all cursor-pointer"
          title={hasRealLocation ? 'Vị trí của bạn' : 'Định vị GPS'}
          id="btn-my-location"
        >
          <span
            className={`material-symbols-outlined text-[22px] ${
              hasRealLocation ? 'text-[#FF6B35]' : 'text-[#8D7168]'
            }`}
          >
            my_location
          </span>
        </button>
      </div>

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

      {/* 6b. BiteBot AI Assistant Floating Action Trigger on Explore (Positioned comfortably above bottom card) */}
      {!activePlace && !selectedBackgroundPOI && !isRadarOpen && onOpenBiteBot && (
        <div className="absolute bottom-34 right-3 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenBiteBot}
            className="group bg-[#2D2926]/90 hover:bg-[#1E1B19] active:scale-95 text-white backdrop-blur-md px-3 py-2 rounded-full shadow-[0_4px_16px_rgba(45,41,38,0.20)] border border-white/15 flex items-center gap-1.5 transition-all cursor-pointer hover:shadow-lg"
            id="btn-map-bitebot-fab"
            title="Hỏi Trợ lý Ẩm thực BiteBot AI"
          >
            <span className="text-xs animate-pulse">✨</span>
            <span className="font-heading text-[11px] font-bold tracking-tight text-white hidden xs:inline">
              BiteBot AI
            </span>
          </button>
        </div>
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

        return (
          <div
            className="absolute bottom-22 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[420px] z-40 transition-all duration-300 transform translate-y-0 pointer-events-auto"
            id="active-background-poi-card"
          >
            <div className="bg-[#FDFCF8] rounded-3xl shadow-[0_-6px_30px_rgba(45,41,38,0.16)] border border-[#2D2926]/10 overflow-hidden flex flex-col p-4 gap-3">
              {/* Header with Title and Close Button */}
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span
                      className="font-heading text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border"
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
                    ) : verifiedCount > 0 ? (
                      <span className="bg-[#D1FAE5] text-[#065F46] border border-[#10B981] font-heading text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>🛡️</span>
                        <span>{verifiedCount} lượt Bite xác minh</span>
                      </span>
                    ) : (
                      <span className="bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7] font-heading text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>🔍 Chưa khám phá (+50 XP)</span>
                      </span>
                    )}
                  </div>
                  <h2 className="font-heading text-lg font-bold text-[#2D2926] leading-snug">
                    {selectedBackgroundPOI.name}
                  </h2>
                  <p className="text-xs text-[#594139] mt-0.5">
                    {selectedBackgroundPOI.address}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBackgroundPOI(null)}
                  className="w-8 h-8 bg-[#F4F4F0] hover:bg-[#EAEAE6] rounded-full flex items-center justify-center text-[#2D2926] transition-all cursor-pointer shrink-0 active:scale-90"
                  id="btn-close-poi-card"
                  title="Đóng"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Distance & Info */}
              <div className="flex items-center justify-between text-xs text-[#594139] bg-[#FAF9F5] p-2.5 rounded-xl border border-[#2D2926]/5">
                <div className="flex items-center gap-1.5 font-heading font-bold text-[#2D2926]">
                  <span className="material-symbols-outlined text-[#FF6B35] text-[18px]">near_me</span>
                  <span>
                    {selectedPOIDistanceM !== null
                      ? selectedPOIDistanceM < 1000
                        ? `${selectedPOIDistanceM}m`
                        : `${(selectedPOIDistanceM / 1000).toFixed(1)}km`
                      : selectedBackgroundPOI.district || 'Gần bạn'}
                  </span>
                </div>
                <span className="text-[11px] text-[#594139]/80 font-medium">
                  {isVisited ? 'Đã lưu trong lịch sử Bite' : 'Mở khóa quán này bằng cách Check-in'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
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
                  className="flex-1 h-11 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-full font-heading text-xs font-bold shadow-md shadow-[#FF6B35]/30 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  id="btn-poi-capture-bite"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  <span>{isVisited ? 'Chụp thêm Bite 📸' : 'Chụp Bite check-in (+50 XP) 📸'}</span>
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
                  className="px-4 bg-white border border-[#2D2926]/10 hover:bg-[#F4F4F0] text-[#2D2926] h-11 rounded-full font-heading text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
                  title="Chỉ đường"
                  id="btn-poi-directions"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#FF6B35]">directions</span>
                  <span>Chỉ đường</span>
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

        return (
          <div
            className="absolute bottom-22 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[420px] z-40 transition-all duration-300 transform translate-y-0 pointer-events-auto"
            id="active-restaurant-card-v2"
          >
            <div className="bg-[#FDFCF8] rounded-3xl shadow-[0_-6px_30px_rgba(45,41,38,0.16)] border border-[#2D2926]/10 overflow-hidden flex flex-col">
              {/* Card Header Image */}
              <div className="h-32 w-full relative">
                <img
                  src={activePlace.imageUrl}
                  alt={activePlace.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlace(null);
                  }}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all cursor-pointer z-20 active:scale-90"
                  title="Đóng để xem lại danh sách"
                  id="btn-close-place-card"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>

                {/* Bookmark Save button */}
                <button
                  onClick={() => onSavePlaceToggle(activePlace.id)}
                  className={`absolute top-3 right-13 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90 ${
                    isSaved ? 'bg-[#00A7CB] text-white' : 'bg-white/90 text-[#2D2926]'
                  }`}
                  title="Lưu quán"
                >
                  <span className="material-symbols-outlined text-[18px] fill">bookmark</span>
                </button>

                {/* Opportunity Type / Visited Pill on Image */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 flex-wrap">
                  {isPlaceVisited ? (
                    <span className="bg-[#10B981] text-white font-heading text-xs font-black px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                      <span>✓ Đã chinh phục</span>
                    </span>
                  ) : (
                    <span className="bg-black/60 backdrop-blur-md text-white font-heading text-xs font-semibold px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
                      <span>🔍 Chưa khám phá (+50 XP)</span>
                    </span>
                  )}

                  {activeOpportunity?.type === 'SCOUT_WINDOW' && !isPlaceVisited && (
                    <span className="bg-[#2EC4B6] text-white font-heading text-xs font-black px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                      <span>🥇 First Verifier</span>
                    </span>
                  )}

                  {activeOpportunity?.type === 'QUEST_MATCH' && !isPlaceVisited && (
                    <span className="bg-[#FF9F1C] text-[#2D2926] font-heading text-xs font-black px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                      <span>🗺️ Khớp Hành trình</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex flex-col gap-3">
                {/* Title & Basic Meta */}
                <div>
                  <div className="flex justify-between items-start mb-0.5">
                    <h2 className="font-heading text-lg font-bold text-[#2D2926]">
                      {activePlace.name}
                    </h2>
                    {hasRealCommunityProof ? (
                      <div className="flex items-center gap-1 bg-[#F4F4F0] px-2 py-0.5 rounded-md" title="Đánh giá từ cộng đồng thực tế">
                        <span className="material-symbols-outlined text-[#FF6B35] text-[15px] fill">
                          star
                        </span>
                        <span className="font-heading text-xs font-bold text-[#2D2926]">
                          {activePlace.rating || '4.5'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-[#F4F4F0] px-2 py-0.5 rounded-md text-[11px] font-heading font-medium text-stone-500">
                        <span>Chưa có review</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-[#594139] flex items-center gap-1.5 font-medium">
                    <span>{activePlace.categoryLabel || activePlace.district}</span>
                    <span className="w-1 h-1 bg-[#8D7168]/40 rounded-full"></span>
                    <span>{activePlace.priceBand || '35k–55k'}</span>
                    <span className="w-1 h-1 bg-[#8D7168]/40 rounded-full"></span>
                    <span className="text-[#006A62] font-semibold">
                      {activePlace.isOpen ? 'Đang mở cửa' : 'Đóng cửa'}
                    </span>
                  </p>
                </div>

                {/* Visited Status / Objective Highlight */}
                {isPlaceVisited ? (
                  <div className="bg-[#ECFDF5] border border-[#10B981]/30 rounded-2xl p-2.5 flex items-center gap-2 text-xs font-heading text-[#065F46] font-bold">
                    <span className="text-base">🎉</span>
                    <span>Bạn đã check-in quán này & hoàn thành thử thách!</span>
                  </div>
                ) : (
                  <div className="bg-[#FAF9F5] rounded-2xl p-3 border border-[#2D2926]/8 flex flex-col gap-2">
                    <div className="text-[10px] font-heading uppercase tracking-wider font-extrabold text-[#594139]/70 flex items-center gap-1">
                      <span>💡 Điểm nổi bật:</span>
                    </div>

                    {/* Render Deterministic Reasons */}
                    {activeOpportunity?.reasons && activeOpportunity.reasons.length > 0 ? (
                      activeOpportunity.reasons.map((reason, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 bg-white p-2 rounded-xl border border-[#2D2926]/5 shadow-xs"
                        >
                          <span className="text-base shrink-0">{reason.icon}</span>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-[#2D2926]">{reason.text}</span>
                            {reason.highlight && (
                              <span className="text-[11px] font-semibold text-[#FF6B35]">
                                {reason.highlight}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-[#2D2926] flex items-center gap-1.5">
                        <span>📍</span>
                        <span>Địa điểm ẩm thực tại {activePlace.district} • Chờ bạn khám phá</span>
                      </div>
                    )}

                    {/* Friend Echo Details if any */}
                    {activeOpportunity?.type === 'FRIEND_ECHO' && activeOpportunity.friendActivity && (
                      <div className="pt-1 text-[11px] text-[#594139] border-t border-[#2D2926]/5 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="font-bold text-[#2D2926]">🔗 Dấu chân bạn bè:</span> {activeOpportunity.friendActivity.chainCount || 1} bạn bè đã ghé đây
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Distance & Address Info */}
                <div className="flex items-center justify-between text-xs text-[#594139] bg-white p-2.5 rounded-xl border border-[#2D2926]/5">
                  <div className="flex items-center gap-1.5 font-heading font-bold text-[#2D2926]">
                    <span className="material-symbols-outlined text-[#FF6B35] text-[18px]">near_me</span>
                    <span>{formattedDistance}</span>
                  </div>
                  <span className="text-[11px] truncate max-w-[200px] text-[#594139]">
                    {activePlace.address}
                  </span>
                </div>

                {/* Dynamic Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (activeOpportunity) {
                        handleOpportunityAction(activeOpportunity);
                      } else {
                        onNavigateToCamera(activePlace);
                      }
                    }}
                    className={`flex-1 h-11 rounded-full font-heading text-xs font-bold shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all text-white cursor-pointer ${
                      activeOpportunity?.type === 'SCOUT_WINDOW'
                        ? 'bg-[#2EC4B6] hover:bg-[#2EC4B6]/90 shadow-[#2EC4B6]/30'
                        : activeOpportunity?.type === 'QUEST_MATCH'
                        ? 'bg-[#FF9F1C] hover:bg-[#FF9F1C]/90 shadow-[#FF9F1C]/30 text-[#2D2926]'
                        : 'bg-[#FF6B35] hover:bg-[#FF6B35]/90 shadow-[#FF6B35]/30'
                    }`}
                    id="btn-smart-cta"
                  >
                    {isPlaceVisited ? (
                      <>
                        <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                        <span>Chụp thêm Bite 📸</span>
                      </>
                    ) : activeOpportunity?.type === 'SCOUT_WINDOW' ? (
                      <>
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        <span>Đi xác minh →</span>
                      </>
                    ) : activeOpportunity?.type === 'QUEST_MATCH' ? (
                      <>
                        <span className="material-symbols-outlined text-[18px]">flag</span>
                        <span>Mở khóa thử thách →</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                        <span>Chụp Bite check-in (+50 XP) 📸</span>
                      </>
                    )}
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
                    className="px-4 bg-white border border-[#2D2926]/10 hover:bg-[#F4F4F0] text-[#2D2926] h-11 rounded-full font-heading text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
                    title="Chỉ đường"
                    id="btn-directions"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#FF6B35]">directions</span>
                    <span>Chỉ đường</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
    </div>
  );
};
