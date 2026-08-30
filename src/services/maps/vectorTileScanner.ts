import { UnifiedPlace } from './types';
import { classifyVenue, CANONICAL_CATEGORIES } from './categoryNormalizer';
import { inferVietnamLocation } from './geoapify/geoapifyPlaces';
import { getDistance } from 'geolib';

// Checks if a string or property value looks like a food/beverage or commercial venue
export function isFoodOrVenueFeature(properties: any, layerId?: string): boolean {
  if (!properties) return false;

  const rawName = String(
    properties.name ||
    properties['name:vi'] ||
    properties['name:latin'] ||
    properties.name_en ||
    properties['name:en'] ||
    ''
  ).trim();

  if (!rawName || rawName.length < 2) return false;

  const lowerName = rawName.toLowerCase();
  const unaccented = lowerName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Strictly exclude Corporate, Telecom, Industrial, Enterprise, Military, Government, Office, and Factory entities
  if (
    /(?:tập\s+đoàn|tap\s+doan|tổng\s+công\s+ty|tong\s+cong\s+ty|công\s+ty|cong\s+ty|doanh\s+nghiệp|doanh\s+nghiep|viễn\s+thông|vien\s+thong|công\s+nghiệp|cong\s+nghiep|quân\s+đội|quan\s+doi|bộ\s+quốc\s+phòng|bộ\s+công\s+an|viettel|vnpt|mobifone|vinaphone|fpt\s+tower|fpt\s+software|cmc\s+tower|keangnam|lotte\s+center|tòa\s+nhà|toa\s+nha|building|tower|corporation|telecom|enterprise|factory|nhà\s+máy|xí\s+nghiệp|kho\s+xưởng|khu\s+công\s+nghiệp|cổ\s+phần|tnhh|jsc|ltd|holdings?|group|văn\s+phòng|van\s+phong|trụ\s+sở|tru\s+so|cơ\s+quan|co\s+quan|viện\s+nghiên\s+cứu|ban\s+quản\s+lý|bưu\s+cục|bưu\s+điện)/i.test(
      lowerName
    ) ||
    /(?:tap\s+doan|cong\s+ty|tong\s+cong\s+ty|vien\s+thong|cong\s+nghiep|quan\s+doi|tru\s+so|van\s+phong|co\s+quan|toa\s+nha|building|tower|telecom|corporation)/i.test(
      unaccented
    )
  ) {
    // Only allow if it's explicitly an internal canteen / food service
    if (!/(?:căng\s+tin|cang\s+tin|nhà\s+ăn|nha\s+an|quán\s+ăn|quan\s+an|tiệm\s+ăn|tiem\s+an|cà\s+phê|cafe|bún|phở|bánh\s+mì|lẩu|nướng|trà\s+sữa|siêu\s+thị|winmart|circle\s+k|gs25|7\s*eleven)/i.test(lowerName)) {
      return false;
    }
  }

  // 2. Ignore pure road names, numbers, administrative boundaries, intersections, traffic junctions, or civil infrastructure
  if (
    /^(đường|phố|ngõ|ngách|hẻm|quốc lộ|ql|tỉnh lộ|đt|tòa nhà|khu đô thị|ct\d+|km\d+|vành đai)/i.test(rawName) ||
    /(?:ngã\s+(?:tư|ba|bảy|sáu|năm|4|3|5|6|7)|qua\s+ngã|qua\s+cầu|qua\s+nút|nút\s+giao|giao\s+lộ|vòng\s+xuyến|bùng\s+binh|vòng\s+xoay|cầu\s+vượt|hầm\s+chui|trục\s+đường|trục\s+[a-z]|đoạn\s+đường|tuyến\s+đường|điểm\s+giao|dải\s+phân\s+cách|vỉa\s+hè|lề\s+đường|nhà\s+chờ\s+xe|điểm\s+dừng\s+xe|trạm\s+xe\s+buýt|bến\s+xe\s+buýt|bus\s+stop|trạm\s+thu\s+phí|trạm\s+biến\s+áp)/i.test(
      rawName
    )
  ) {
    // Only allow if it's explicitly named as a food place (e.g. "Quán Ăn Ngã Tư")
    if (!/(?:quán\s+ăn|nhà\s+hàng|tiệm\s+ăn|cà\s+phê|cafe|bún|phở|bánh\s+mì|lẩu|nướng|trà\s+sữa|siêu\s+thị|winmart|circle\s+k|gs25|7\s*eleven)/i.test(rawName)) {
      return false;
    }
  }

  // 3. Strictly exclude non-food facilities (swimming pools, embassies, schools, hospitals, offices, temples, sports, banks, etc.)
  if (
    /(?:bể\s+bơi|hồ\s+bơi|swimming\s+pool|clb\s+bơi|bơi\s+lội|đại\s+sứ\s+quán|embassy|lãnh\s+sự\s+quán|consulate|trường\s+(?:tiểu\s+học|trung\s+học|thcs|thpt|đại\s+học|cao\s+đẳng|mầm\s+non|mẫu\s+giáo)|thpt|thcs|bệnh\s+viện|phòng\s+khám|trạm\s+y\s+tế|nha\s+khoa|nhà\s+thuốc|hiệu\s+thuốc|ủy\s+ban|ubnd|công\s+an|cảnh\s+sát|ngân\s+hàng|trụ\s+sở|chùa\s+|đền\s+|đình\s+|miếu\s+|nhà\s+thờ\s+|nghĩa\s+trang|sân\s+bóng|sân\s+vận\s+động|sân\s+tennis|sân\s+golf|sân\s+cầu\s+lông|phòng\s+gym|fitness|yoga|bida|bi-a|bến\s+xe|nhà\s+ga|sân\s+bay|bãi\s+đỗ\s+xe|bãi\s+giữ\s+xe|gara|trạm\s+xăng|cây\s+xăng|sửa\s+xe|rửa\s+xe|thời\s+trang|quần\s+áo|shop\s+quần\s+áo|giày\s+dép|mỹ\s+phẩm|tiệm\s+vàng|cắt\s+tóc|salon|spa|massage|thẩm\s+mỹ|giặt\s+là|khách\s+sạn|nhà\s+nghỉ|homestay)/i.test(
      rawName
    ) &&
    !/(?:căng\s+tin|quán\s+ăn|nhà\s+hàng|tiệm\s+ăn|cà\s+phê|cafe|cơm|bún|phở|bánh|siêu\s+thị|bách\s+hóa|winmart|circle\s+k|gs25|7\s*eleven)/i.test(rawName)
  ) {
    return false;
  }

  const pClass = String(
    properties.class ||
    properties.subclass ||
    properties.amenity ||
    properties.shop ||
    properties.cuisine ||
    properties.category ||
    properties.type ||
    properties.maki ||
    properties.kind ||
    properties.office ||
    layerId ||
    ''
  ).toLowerCase();

  // Exclude non-food amenity / office / infrastructure types from OSM & Vector tiles
  const nonFoodClasses = [
    'office',
    'company',
    'telecommunication',
    'telecom',
    'industrial',
    'corporate',
    'commercial.office',
    'commercial.industrial',
    'commercial.telecom',
    'coworking',
    'administrative',
    'government',
    'embassy',
    'diplomatic',
    'consulate',
    'swimming_pool',
    'swimming',
    'pool',
    'water_park',
    'school',
    'kindergarten',
    'university',
    'college',
    'library',
    'driving_school',
    'hospital',
    'clinic',
    'doctors',
    'pharmacy',
    'dentist',
    'veterinary',
    'bank',
    'atm',
    'bureau_de_change',
    'police',
    'place_of_worship',
    'church',
    'mosque',
    'synagogue',
    'temple',
    'shrine',
    'cemetery',
    'grave_yard',
    'fuel',
    'parking',
    'parking_space',
    'parking_entrance',
    'post_office',
    'townhall',
    'town_hall',
    'courthouse',
    'fire_station',
    'prison',
    'stadium',
    'sports_centre',
    'pitch',
    'track',
    'fitness_centre',
    'sports_hall',
    'gym',
    'car_repair',
    'car_wash',
    'charging_station',
    'hotel',
    'motel',
    'hostel',
    'guest_house',
    'clothing',
    'clothes',
    'fashion',
    'shoes',
    'hairdresser',
    'beauty',
    'spa',
    'optician',
    'jewelry',
    'jewellery',
    'chemist',
    'tailor',
    'laundry',
    'dry_cleaning',
    'junction',
    'intersection',
    'traffic_signals',
    'crossing',
    'turning_circle',
    'roundabout',
    'mini_roundabout',
    'highway',
    'road',
    'street',
    'path',
    'footway',
    'cycleway',
    'pedestrian',
    'bus_stop',
    'platform',
    'stop_position',
    'public_transport',
    'toll_booth',
    'bridge',
    'tunnel',
  ];

  if (nonFoodClasses.some((c) => pClass.includes(c))) {
    return false;
  }

  const foodClassKeywords = [
    'cafe',
    'coffee',
    'restaurant',
    'fast_food',
    'food',
    'bakery',
    'bar',
    'pub',
    'ice_cream',
    'biergarten',
    'food_court',
    'tea',
    'beverages',
    'deli',
    'caterer',
    'confectionery',
    'pastry',
    'eatery',
    'meal_takeaway',
    'meal_delivery',
    'supermarket',
    'convenience',
    'grocery',
    'greengrocer',
    'butcher',
    'fishmonger',
    'general_store',
    'market',
    'food_and_drink',
  ];

  if (foodClassKeywords.some((k) => pClass.includes(k))) {
    return true;
  }

  // Exact whole-phrase or word-bounded regex for Vietnamese food & beverage venues
  // Covers any venue named with dining prefixes (Quán, Tiệm, Bếp, Lò, Nhà hàng, Ẩm thực, Đặc sản, Ăn vặt, etc.)
  // and all Vietnamese & international dishes, ingredients, drinks, and snacks
  const vietnameseFoodNamePatterns = [
    // 1. Food and dining establishment prefixes
    /(?:^|[\s,./\-_(])(?:quán|quan|tiệm|tiem|bếp|bep|lò|lo|nhà\s+hàng|nha\s+hang|ẩm\s+thực|am\s+thuc|đặc\s+sản|dac\s+san|ăn\s+vặt|an\s+vat|quán\s+ăn|quan\s+an|tiệm\s+ăn|tiem\s+an|nhà\s+ăn|nha\s+an|căng\s+tin|cang\s+tin|canteen|bistro|diner|eatery|kitchen|quán\s+nhậu|quan\s+nhau|nhậu|nhau|quán\s+cơm|quan\s+com|quán\s+nước|quan\s+nuoc|quán\s+bia|quan\s+bia|quán\s+ốc|quan\s+oc|quán\s+chè|quan\s+che)(?:$|[\s,./\-_)])/i,
    
    // 2. Coffee, tea, milk tea, juices, drinks, ice cream & desserts
    /(?:^|[\s,./\-_(])(?:coffee|cafe|café|cà\s+phê|caphe|trà|tra|trà\s+sữa|tra\s+sua|milktea|milk\s+tea|trà\s+chanh|tra\s+chanh|trà\s+đào|tra\s+dao|matcha|sinh\s+tố|sinh\s+to|nước\s+mía|nuoc\s+mia|nước\s+ép|nuoc\s+ep|nước\s+dừa|nuoc\s+dua|sữa\s+chua|sua\s+chua|kem|gelato|ice\s+cream|chè|che|che\s+sầu|tàu\s+hũ|tau\s+hu|đậu\s+hũ|dau\s+hu)(?:$|[\s,./\-_)])/i,
    
    // 3. Bakery, bread & pastries
    /(?:^|[\s,./\-_(])(?:bánh\s+mì|banh\s+mi|bánh\s+ngọt|banh\s+ngot|tiệm\s+bánh|tiem\s+banh|bánh\s+kem|banh\s+kem|bánh\s+sinh\s+nhật|bakery|patisserie|pastry|cake|croissant|donut|bánh\s+bao|banh\s+bao|bánh\s+gối|banh\s+goi|bánh\s+bột\s+lọc|bánh\s+tráng|banh\s+trang)(?:$|[\s,./\-_)])/i,
    
    // 4. Noodles, soups & broths
    /(?:^|[\s,./\-_(])(?:phở|pho\s+|bún|bun\s+|miến|mien\s+|mì\s+|my\s+|hủ\s+tiếu|hu\s+tieu|bánh\s+canh|banh\s+canh|bánh\s+đa|banh\s+da|mì\s+vằn\s+thắn|mì\s+quảng|mì\s+cay|bún\s+bò|bún\s+chả|bún\s+đậu|bún\s+riêu|bún\s+thang|bún\s+cá|bún\s+ốc|bún\s+mọc|bún\s+ngan|ramen|udon|soba)(?:$|[\s,./\-_)])/i,
    
    // 5. Rice dishes, porridge & sticky rice
    /(?:^|[\s,./\-_(])(?:cơm|com|cơm\s+tấm|com\s+tam|cơm\s+niêu|com\s+nieu|cơm\s+chay|com\s+chay|cơm\s+bình\s+dân|com\s+binh\s+dan|cơm\s+rang|com\s+rang|cơm\s+gà|com\s+ga|cơm\s+sườn|cháo|chao|cháo\s+lòng|cháo\s+ếch|cháo\s+vịt|cháo\s+gà|xôi|xoi|xôi\s+xéo|xôi\s+bắp|xôi\s+gà|bánh\s+cuốn|banh\s+cuon|bánh\s+xèo|banh\s+xeo|bánh\s+căn|bánh\s+khọt|bánh\s+bèo)(?:$|[\s,./\-_)])/i,
    
    // 6. Hotpot, BBQ, grills & meat/poultry specialties
    /(?:^|[\s,./\-_(])(?:lẩu|lau\s+|nướng|nuong\s+|bbq|barbecue|grill|yakiniku|buffet|bò|bo|bò\s+tơ|bò\s+né|bò\s+nướng|bò\s+sốt\s+vang|bít\s+tết|steak|gà|ga|gà\s+rán|gà\s+nướng|gà\s+tần|gà\s+tươi|vịt|vit|vịt\s+quay|vịt\s+nướng|vịt\s+cỏ|ngan|chim|dê|de|lẩu\s+dê|thịt\s+dê|bê\s+thui|heo\s+quay|thịt\s+nướng|lòng\s+nướng|lòng\s+rán)(?:$|[\s,./\-_)])/i,
    
    // 7. Seafood, snail, rolls, sausage & specialties
    /(?:^|[\s,./\-_(])(?:hải\s+sản|hai\s+san|ốc|oc|ốc\s+luộc|ốc\s+xào|hàu|nghêu|sò|tôm|cua|mực|cá|cá\s+lăng|chả\s+cá|nem|nem\s+nướng|nem\s+chua|nem\s+lụi|nem\s+rán|chả|chả\s+mực|chả\s+rươi|chả\s+quế|gỏi|goi|nộm|nom|ếch|ech|lươn|luon)(?:$|[\s,./\-_)])/i,
    
    // 8. International, Fast Food & Western
    /(?:^|[\s,./\-_(])(?:pizza|burger|hamburger|sandwich|pasta|spaghetti|sushi|sashimi|dimsum|dim\s+sum|tokbokki|topokki|kimbap|doner|kebab|taco|kfc|lotteria|jollibee|mcdonald)(?:$|[\s,./\-_)])/i,
    
    // 9. Beer, Pubs & Bars
    /(?:^|[\s,./\-_(])(?:bia|beer|bia\s+hơi|bia\s+hoi|bia\s+tươi|bia\s+tuoi|craft\s+beer|vuvuzela|bar|pub|lounge)(?:$|[\s,./\-_)])/i,
    
    // 10. Vegetarian
    /(?:^|[\s,./\-_(])(?:chay|vegan|vegetarian|thực\s+dưỡng|thuc\s+duong)(?:$|[\s,./\-_)])/i,
    
    // 11. Supermarket, convenience store, food market
    /(?:^|[\s,./\-_(])(?:siêu\s+thị|sieu\s+thi|bách\s+hóa|bach\s+hoa|bách\s+hóa\s+xanh|cửa\s+hàng\s+tiện\s+lợi|winmart|vinmart|circle\s+k|gs25|7\s*eleven|seven\s+eleven|familymart|ministop|coopmart|co\.?op\s*mart|big\s+c|go!?|lotte\s+mart|aeon|mega\s+market|brg\s+mart|fuji\s+mart|hapro\s+mart|chợ\s+ẩm\s+thực|food\s+market)(?:$|[\s,./\-_)])/i,
  ];

  if (
    vietnameseFoodNamePatterns.some((pattern) => pattern.test(lowerName) || pattern.test(unaccented))
  ) {
    return true;
  }

  return false;
}

// Convert a MapLibre vector tile feature to a UnifiedPlace
export function convertVectorFeatureToPlace(
  feature: any,
  referenceLocation?: { latitude: number; longitude: number }
): UnifiedPlace | null {
  if (!feature || !feature.properties) return null;

  const props = feature.properties;
  if (!isFoodOrVenueFeature(props, feature.layer?.id)) {
    return null;
  }

  const name = String(
    props.name ||
    props['name:vi'] ||
    props['name:latin'] ||
    props.name_en ||
    props['name:en'] ||
    ''
  ).trim();

  if (!name || name.length < 2) return null;

  let lat: number | undefined;
  let lon: number | undefined;

  if (feature.geometry) {
    if (feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
      lon = feature.geometry.coordinates[0];
      lat = feature.geometry.coordinates[1];
    } else if (feature.geometry.coordinates && Array.isArray(feature.geometry.coordinates)) {
      // Polygon / MultiPoint center fallback
      const coords = feature.geometry.coordinates;
      const flatCoords: [number, number][] = [];
      const extractPoints = (arr: any) => {
        if (Array.isArray(arr) && arr.length >= 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
          flatCoords.push([arr[0], arr[1]]);
        } else if (Array.isArray(arr)) {
          arr.forEach(extractPoints);
        }
      };
      extractPoints(coords);
      if (flatCoords.length > 0) {
        let sumLon = 0;
        let sumLat = 0;
        flatCoords.forEach(([x, y]) => {
          sumLon += x;
          sumLat += y;
        });
        lon = sumLon / flatCoords.length;
        lat = sumLat / flatCoords.length;
      }
    }
  }

  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return null;
  }

  const pClass = String(
    props.class ||
    props.subclass ||
    props.amenity ||
    props.shop ||
    props.cuisine ||
    props.category ||
    feature.layer?.id ||
    'restaurant'
  );

  const classification = classifyVenue({
    name,
    category: pClass,
    categories: [props.class, props.subclass, props.amenity, props.shop, props.cuisine].filter(Boolean),
  });

  const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;
  const loc = inferVietnamLocation(
    lat,
    lon,
    props.district || props['addr:district'],
    props.city || props['addr:city'],
    props.state || props['addr:province']
  );

  const dist = referenceLocation
    ? getDistance(referenceLocation, { latitude: lat, longitude: lon })
    : 0;

  const id = `map_poi_${props.osm_id || props.id || `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${lat.toFixed(4)}_${lon.toFixed(4)}`}`;

  const address = props['addr:street']
    ? `${props['addr:housenumber'] || ''} ${props['addr:street']}`.trim()
    : `${loc.district}, ${loc.city}`;

  return {
    id,
    providerId: props.osm_id ? String(props.osm_id) : undefined,
    name,
    category: classification.category,
    categoryLabel: catMeta.label,
    address,
    district: loc.district,
    city: loc.city,
    latitude: lat,
    longitude: lon,
    distanceMeters: dist,
  };
}

// Scans all rendered features across vector map tiles and returns valid places
export function scanRenderedMapPlaces(
  map: any,
  referenceLocation?: { latitude: number; longitude: number }
): UnifiedPlace[] {
  if (!map || typeof map.queryRenderedFeatures !== 'function') return [];

  try {
    const renderedFeatures = map.queryRenderedFeatures();
    if (!Array.isArray(renderedFeatures) || renderedFeatures.length === 0) return [];

    const results: UnifiedPlace[] = [];
    const seen = new Set<string>();

    for (const f of renderedFeatures) {
      if (!isFoodOrVenueFeature(f.properties, f.layer?.id)) continue;

      const place = convertVectorFeatureToPlace(f, referenceLocation);
      if (!place) continue;

      const key = `${place.name.toLowerCase().trim()}_${place.latitude.toFixed(3)}_${place.longitude.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push(place);
    }

    return results;
  } catch (err) {
    console.warn('[vectorTileScanner] Error scanning rendered map features:', err);
    return [];
  }
}
