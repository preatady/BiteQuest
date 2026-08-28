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
  minzoom: 13,
  layout: {
    'icon-image': ['coalesce', ['get', 'iconName'], 'icon-other_food'],
    'icon-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      13,
      0.75,
      15,
      0.9,
      17,
      1.0,
    ],
    'icon-allow-overlap': false,
    'icon-ignore-placement': false,
    'icon-padding': 2,
  },
};

// Ambient Venue Name Label Layer (Consumer map style, zoom-scaled with collision handling)
const ambientVenueLabelLayer: any = {
  id: 'ambient-venue-labels',
  type: 'symbol',
  source: 'background-pois',
  filter: ['!', ['has', 'point_count']],
  minzoom: 14,
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      14,
      10,
      16,
      11.5,
      17,
      12.5,
    ],
    'text-offset': [0, 1.25],
    'text-anchor': 'top',
    'text-max-width': 8.5,
    'text-padding': 2,
    'text-optional': true,
    'text-allow-overlap': false,
    'text-ignore-placement': false,
  },
  paint: {
    'text-color': '#1C1917',
    'text-halo-color': '#FFFFFF',
    'text-halo-width': 2.5,
    'text-halo-blur': 0.5,
    'text-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      14,
      0.8,
      15,
      0.95,
      16,
      1.0,
    ],
  },
};

// Far zoom subtle dot layer when zoom < 13
const unclusteredFarCircleLayer: any = {
  id: 'unclustered-far-circle',
  type: 'circle',
  source: 'background-pois',
  filter: ['!', ['has', 'point_count']],
  maxzoom: 13,
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
  } = useExploreNearbyPlaces();
  const [selectedBackgroundPOI, setSelectedBackgroundPOI] = useState<UnifiedPlace | null>(null);
  const [viewportCenter, setViewportCenter] = useState<{ latitude: number; longitude: number }>(FALLBACK_CENTER);
  const [searchAreaError, setSearchAreaError] = useState<boolean>(false);

  const isVenueSelected = Boolean(selectedPlace || selectedBackgroundPOI);
  const isPannedAboveThreshold = useMemo(() => {
    if (!lastFetchedCenter || !viewportCenter) return false;
    return getDistance(lastFetchedCenter, viewportCenter) > 450;
  }, [lastFetchedCenter, viewportCenter]);

  const showSearchThisArea = isPannedAboveThreshold && !isVenueSelected;

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

  // Dynamic filter chips derived strictly from all venues in current map area
  const allLoadedVenues = useMemo(() => {
    return [...places, ...unpromotedNearbyPOIs];
  }, [places, unpromotedNearbyPOIs]);

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
    return new Set(
      (feedBites || [])
        .filter((b) => b.userId === user?.id && b.isVerified)
        .map((b) => b.placeId)
    );
  }, [feedBites, user?.id]);

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
            iconName: `icon-${canonicalCat.toLowerCase()}`,
            color: meta.color,
            address: poi.address,
            district: poi.district,
            city: poi.city || 'Hà Nội',
            distanceMeters: poi.distanceMeters,
            verifiedBiteCount: (poi as any).verifiedBiteCount || 0,
          },
        };
      }),
    };
  }, [filteredUnpromotedNearbyPOIs]);

  // Filter promoted places (Zero network fetch)
  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
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
  }, [places, activeCategoryFilter, searchQuery]);

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

  // Selected background POI distance calculation
  const selectedPOIDistanceM = useMemo(() => {
    if (!selectedBackgroundPOI) return null;
    return getDistance(referenceLocation, {
      latitude: selectedBackgroundPOI.latitude,
      longitude: selectedBackgroundPOI.longitude,
    });
  }, [selectedBackgroundPOI, referenceLocation]);

  const handleFlyTo = (lat: number, lng: number) => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 15.5,
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

  // MapLibre click handler: intercepts cluster expansions and unclustered background POI taps
  const handleMapClick = useCallback((event: any) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

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

    // Tapping empty map dismisses active place & background POI cards
    onSelectPlace(null);
    setSelectedBackgroundPOI(null);
  }, [nearbyPOIs, onSelectPlace]);

  // Viewport tracking for "Tìm khu vực này" button
  const handleMapMoveEnd = useCallback((e: any) => {
    const center = e.target.getCenter();
    const newCenter = { latitude: center.lat, longitude: center.lng };
    setViewportCenter(newCenter);
    setSearchAreaError(false);
  }, []);

  const handleSearchThisArea = async () => {
    if (isLoadingPOIs) return;
    setSearchAreaError(false);
    try {
      const places = await fetchNearbyPOIs(viewportCenter, 2000, {
        anchor: {
          latitude: referenceLocation.latitude,
          longitude: referenceLocation.longitude,
          isRealUserLocation: hasRealLocation,
        },
      });
      if (!places || !Array.isArray(places)) {
        setSearchAreaError(true);
      }
    } catch {
      setSearchAreaError(true);
    }
  };

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
            const isTopOpportunity = radarOpportunities.length > 0 && radarOpportunities[0].placeId === place.id;

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
                  {/* Subtle Top Opportunity Pill (BiteQuest Promoted Radar Highlight - Max 1) */}
                  {isTopOpportunity && !isSelected && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#FF6B35] text-white text-[9.5px] font-heading font-semibold shadow-[0_2px_8px_rgba(255,107,53,0.35)] whitespace-nowrap flex items-center gap-1 border border-white/90 animate-fade-in pointer-events-none z-30">
                      <span className="text-[9px]">✨</span>
                      <span>Đáng đi</span>
                    </div>
                  )}

                  {/* Outer Pulsing Opportunity Ring */}
                  {isScout && (
                    <div className="absolute -inset-2 rounded-full bg-[#2EC4B6]/30 animate-ping pointer-events-none"></div>
                  )}
                  {isQuest && (
                    <div className="absolute -inset-2 rounded-full bg-[#FF9F1C]/30 animate-ping pointer-events-none"></div>
                  )}

                  {/* Marker Pin Head */}
                  <div
                    className={`relative flex items-center justify-center rounded-full border-2 transition-all shadow-md ${
                      isSelected
                        ? 'w-10 h-10 bg-[#FF6B35] border-white scale-110 shadow-lg'
                        : isTopOpportunity
                        ? 'w-9 h-9 bg-[#FF6B35] border-white ring-2 ring-[#FF6B35]/25 shadow-md'
                        : isScout
                        ? 'w-9 h-9 bg-[#2EC4B6] border-white'
                        : isQuest
                        ? 'w-9 h-9 bg-[#FF9F1C] border-[#2D2926]'
                        : isFriendEcho
                        ? 'w-9 h-9 bg-[#FF6B35] border-white'
                        : 'w-8 h-8 bg-white border-[#2D2926]/20'
                    }`}
                  >
                    <span className="text-sm">
                      {isScout ? '🥇' : isQuest ? '🗺️' : isFriendEcho ? '👥' : CANONICAL_CATEGORIES[normalizeCategory(place)]?.symbolGlyph || '🍴'}
                    </span>

                    {/* Bookmark Indicator Badge */}
                    {isBookmarked && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#00A7CB] rounded-full border border-white flex items-center justify-center">
                        <span className="text-[8px] text-white">★</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Pin Tip */}
                  <div
                    className={`w-0 h-0 mx-auto border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] -mt-0.5 ${
                      isSelected || isTopOpportunity
                        ? 'border-t-[#FF6B35]'
                        : isScout
                        ? 'border-t-[#2EC4B6]'
                        : isQuest
                        ? 'border-t-[#FF9F1C]'
                        : isFriendEcho
                        ? 'border-t-[#FF6B35]'
                        : 'border-t-white'
                    }`}
                  ></div>

                  {/* Hover Tooltip */}
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#2D2926]/90 text-white font-heading text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow z-40">
                    {place.name}
                  </div>
                </div>
              </Marker>
            );
          })}
        </MapGL>
      </div>

      {/* 2. "Tìm khu vực này" Floating Pill Button (Appears when map is panned > 450m) */}
      {showSearchThisArea && (
        <div className="absolute top-[116px] md:top-[120px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto transition-all">
          <button
            type="button"
            onClick={handleSearchThisArea}
            disabled={isLoadingPOIs}
            className="bg-white/95 hover:bg-white text-[#2D2926] backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.10)] border border-stone-200/90 flex items-center gap-1.5 text-xs font-heading font-medium active:scale-95 transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
            id="btn-search-this-area"
          >
            {isLoadingPOIs ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin"></span>
                <span className="text-stone-600">Đang tìm quán...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[15px] text-[#FF6B35]">refresh</span>
                <span>{searchAreaError ? 'Thử lại tìm khu vực này' : 'Tìm khu vực này'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 3. TOP EXPLORE CONTROLS (V6 EDITORIAL FOOD NAVIGATION) */}
      <div className="absolute top-2.5 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:w-[500px] z-30 pointer-events-auto flex flex-col gap-1.5">
        {/* Primary Search Bar */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl h-11 px-3.5 flex items-center gap-2.5 shadow-[0_2px_12px_rgba(45,41,38,0.08)] border border-[#2D2926]/8 focus-within:border-[#FF6B35]/50 focus-within:shadow-[0_4px_16px_rgba(255,107,53,0.12)] transition-all">
          <span className="material-symbols-outlined text-[#2D2926]/45 text-[19px] shrink-0">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm món, quán hoặc khu vực"
            className="bg-transparent border-none focus:outline-none w-full text-[13px] font-normal text-[#2D2926] placeholder:text-[#2D2926]/40"
            id="input-explore-search"
            aria-label="Tìm món, quán hoặc khu vực"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-5 h-5 rounded-full bg-[#2D2926]/8 hover:bg-[#2D2926]/15 flex items-center justify-center text-[10px] text-[#2D2926] transition-colors shrink-0 cursor-pointer"
              aria-label="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Lightweight Food Intent Navigation Bar (Editorial & Mobile-Native) */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_2px_10px_rgba(45,41,38,0.06)] border border-[#2D2926]/6 p-1 flex items-center relative">
          <div
            className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth w-full pr-1"
            role="tablist"
            aria-label="Bộ lọc ẩm thực nhanh"
          >
            {quickFilterChips.map((chip) => {
              const isSelected = activeCategoryFilter === chip.id;
              const glyph = chip.metadata?.symbolGlyph || '🍴';
              const label = chip.metadata?.shortLabel || chip.label;

              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSelectCategoryFilter(chip.id)}
                  className={`shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl text-[13px] font-heading flex items-center gap-1.5 transition-all select-none cursor-pointer whitespace-nowrap active:scale-95 focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:outline-none ${
                    isSelected
                      ? 'text-[#EA580C] font-semibold bg-[#FF6B35]/10 relative after:absolute after:bottom-1 after:left-3 after:right-3 after:h-[2px] after:bg-[#FF6B35] after:rounded-full'
                      : 'text-[#57534E] hover:text-[#1C1917] hover:bg-black/4 font-medium bg-transparent'
                  }`}
                  id={`filter-chip-${chip.id.toLowerCase()}`}
                >
                  <span className="text-[12px] leading-none shrink-0 opacity-90">{glyph}</span>
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              );
            })}

            {/* Subtle Divider */}
            <div className="w-[1px] h-5 bg-[#2D2926]/10 shrink-0 mx-0.5" />

            {/* Full Category Filter Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowFullFilterSheet(true)}
              className={`shrink-0 min-h-[44px] px-3 py-2 rounded-xl text-[12.5px] font-heading font-medium flex items-center gap-1.5 transition-all select-none cursor-pointer whitespace-nowrap active:scale-95 focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:outline-none ${
                activeCategoryFilter !== 'ALL' &&
                !quickFilterChips.some((c) => c.id === activeCategoryFilter)
                  ? 'text-[#EA580C] font-semibold bg-[#FF6B35]/10'
                  : 'text-[#57534E] hover:text-[#1C1917] hover:bg-black/4 bg-transparent'
              }`}
              id="btn-open-full-filter"
              aria-label="Xem tất cả bộ lọc danh mục ẩm thực"
            >
              <span className="material-symbols-outlined text-[16px] text-[#FF6B35]">tune</span>
              <span>Bộ lọc</span>
              {activeCategoryFilter !== 'ALL' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* 10km Discovery Boundary Warning (Only when beyond boundary) */}
        {isBeyondBoundary && (
          <div className="bg-amber-600/95 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-heading font-semibold flex items-center justify-center gap-1.5 shadow-sm animate-fade-in text-center">
            <span>⚠️</span>
            <span>Đã đạt giới hạn 10km từ vị trí thực tế của bạn</span>
          </div>
        )}
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

      {/* 6a. Discovery Peek Sheet (First-Open Today Hook on Explore) */}
      {!activePlace && !selectedBackgroundPOI && !isRadarOpen && (
        <div className="absolute bottom-22 left-0 right-0 z-30 pointer-events-none">
          <DiscoveryPeekSheet
            todayOpportunities={todayOpportunities}
            totalVenuesCount={allLoadedVenues.length}
            isRealUserLocation={referenceLocation.isRealUserLocation}
            isLoading={isLoadingPOIs}
            onSelectVenue={handleSelectVenueFromPeek}
          />
        </div>
      )}

      {/* 6b. Bottom Opportunity Carousel (Rendered when Radar destination/tab is active) */}
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

                    {verifiedCount > 0 ? (
                      <span className="bg-[#D1FAE5] text-[#065F46] border border-[#10B981] font-heading text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>🛡️</span>
                        <span>{verifiedCount} lượt Bite xác minh</span>
                      </span>
                    ) : (
                      <span className="bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7] font-heading text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>Chưa có lượt Bite</span>
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
                  Dữ liệu bản đồ Geoapify / OpenStreetMap
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
                  <span>Chụp Bite tại đây 📸</span>
                </button>

                <button
                  onClick={() => {
                    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      selectedBackgroundPOI.name + ' ' + selectedBackgroundPOI.address
                    )}`;
                    window.open(googleMapsUrl, '_blank');
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
      {activePlace && (
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

              {/* Opportunity Type Pill on Image */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                {activeOpportunity?.type === 'SCOUT_WINDOW' && (
                  <span className="bg-[#2EC4B6] text-white font-heading text-xs font-black px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                    <span>🥇 First Verifier</span>
                  </span>
                )}

                {activeOpportunity?.type === 'QUEST_MATCH' && (
                  <span className="bg-[#FF9F1C] text-[#2D2926] font-heading text-xs font-black px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                    <span>🗺️ Khớp Hành trình</span>
                  </span>
                )}

                {activeOpportunity?.type === 'STARTER_QUEST' && (
                  <span className="bg-[#2EC4B6] text-white font-heading text-xs font-black px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                    <span>🌱 Starter Bite</span>
                  </span>
                )}

                {activeOpportunity?.type === 'FRESH_VERIFIED' && (
                  <span className="bg-[#2EC4B6] text-white font-heading text-xs font-black px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                    <span>✨ Vừa xác minh</span>
                  </span>
                )}

                {activeOpportunity?.type === 'NEW_TO_YOU' && (
                  <span className="bg-[#FF6B35] text-white font-heading text-xs font-black px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                    <span>👀 Mới với bạn</span>
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
                  <div className="flex items-center gap-1 bg-[#F4F4F0] px-2 py-0.5 rounded-md">
                    <span className="material-symbols-outlined text-[#FF6B35] text-[15px] fill">
                      star
                    </span>
                    <span className="font-heading text-xs font-bold text-[#2D2926]">
                      {activePlace.rating}
                    </span>
                  </div>
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

              {/* "WHY THIS PIN?" / REASONS TO GO NOW */}
              <div className="bg-[#FAF9F5] rounded-2xl p-3 border border-[#2D2926]/8 flex flex-col gap-2">
                <div className="text-[10px] font-heading uppercase tracking-wider font-extrabold text-[#594139]/70 flex items-center gap-1">
                  <span>💡 Lý do nên đi lúc này:</span>
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
                    <span>✨</span>
                    <span>Địa điểm được cộng đồng ẩm thực đánh giá cao tại {activePlace.district}</span>
                  </div>
                )}

                {/* Friend Echo Bite Chain Details */}
                {activeOpportunity?.type === 'FRIEND_ECHO' && activeOpportunity.friendActivity && (
                  <div className="pt-1 text-[11px] text-[#594139] border-t border-[#2D2926]/5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="font-bold text-[#2D2926]">🔗 Bite Chain:</span> {activeOpportunity.friendActivity.chainCount || 3} người đã đi theo dấu Bite này
                    </span>
                  </div>
                )}

                {/* Scout Window Details */}
                {activeOpportunity?.type === 'SCOUT_WINDOW' && (
                  <div className="pt-1 text-[11px] text-[#006A62] border-t border-[#2D2926]/5 flex items-center justify-between font-medium">
                    <span>Người phát hiện: {activeOpportunity.scoutData?.discoveredBy}</span>
                    <span className="font-bold">0 người xác minh</span>
                  </div>
                )}
              </div>

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
                      : activeOpportunity?.type === 'STARTER_QUEST'
                      ? 'bg-[#FF6B35] hover:bg-[#FF6B35]/90 shadow-[#FF6B35]/30'
                      : 'bg-[#FF6B35] hover:bg-[#FF6B35]/90 shadow-[#FF6B35]/30'
                  }`}
                  id="btn-smart-cta"
                >
                  {activeOpportunity?.type === 'SCOUT_WINDOW' ? (
                    <>
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      <span>Đi xác minh →</span>
                    </>
                  ) : activeOpportunity?.type === 'QUEST_MATCH' ? (
                    <>
                      <span className="material-symbols-outlined text-[18px]">flag</span>
                      <span>Mở khóa thử thách →</span>
                    </>
                  ) : activeOpportunity?.type === 'STARTER_QUEST' ? (
                    <>
                      <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                      <span>Bắt đầu Bite ngay 📸</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                      <span>Chụp Bite ngay 📸</span>
                    </>
                  )}
                </button>

                {/* External Directions */}
                <button
                  onClick={() => {
                    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      activePlace.name + ' ' + activePlace.address
                    )}`;
                    window.open(googleMapsUrl, '_blank');
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
