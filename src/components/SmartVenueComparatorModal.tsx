/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Place } from '../types';
import { UnifiedPlace } from '../services/maps/types';
import {
  DayType,
  TrafficRouteResult,
  analyzeTrafficRoutes,
  getHourCongestionFactor,
} from '../services/maps/trafficSmartRoutingService';
import {
  HourlyWeatherForecast,
  getSyntheticHourlyWeather,
} from '../services/maps/weatherFloodService';
import { buildGoogleMapsDirectionsUrl } from '../utils/navigationHelper';

interface SmartVenueComparatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: (Place | UnifiedPlace)[];
  userLocation: { latitude: number; longitude: number };
  initialSelectedVenues?: (Place | UnifiedPlace)[];
  weatherForecasts?: HourlyWeatherForecast[];
  onSelectDestination: (venue: Place | UnifiedPlace, route?: TrafficRouteResult) => void;
}

export const SmartVenueComparatorModal: React.FC<SmartVenueComparatorModalProps> = ({
  isOpen,
  onClose,
  places,
  userLocation,
  initialSelectedVenues = [],
  weatherForecasts,
  onSelectDestination,
}) => {
  // Target hour and day type for smart traffic calculation
  const currentRealHour = new Date().getHours();
  const [selectedHour, setSelectedHour] = useState<number>(
    currentRealHour >= 18 && currentRealHour <= 20 ? currentRealHour : 19
  );
  const [selectedDayType, setSelectedDayType] = useState<DayType>('weekday');
  const [activeTab, setActiveTab] = useState<'matrix' | 'traffic' | 'ai_verdict'>('matrix');

  // Selected venues to compare (2 or 3)
  const [comparedVenues, setComparedVenues] = useState<(Place | UnifiedPlace)[]>(() => {
    if (initialSelectedVenues.length >= 2) {
      return initialSelectedVenues.slice(0, 3);
    }
    if (initialSelectedVenues.length === 1) {
      // Pick 1 or 2 other interesting places nearby
      const others = places.filter((p) => p.id !== initialSelectedVenues[0].id).slice(0, 2);
      return [initialSelectedVenues[0], ...others];
    }
    return places.slice(0, 3);
  });

  // Sync if initialSelectedVenues changes when modal opens
  React.useEffect(() => {
    if (isOpen && initialSelectedVenues.length > 0) {
      const unique = Array.from(new Set([...initialSelectedVenues, ...comparedVenues])).filter(Boolean);
      setComparedVenues(unique.slice(0, 3));
    }
  }, [isOpen, initialSelectedVenues]);

  // Search to add more venues to compare
  const [searchPickerQuery, setSearchPickerQuery] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Compute traffic analysis for all compared venues
  const comparedTrafficResults = useMemo(() => {
    if (!comparedVenues.length || !userLocation) return [];
    return analyzeTrafficRoutes({
      userLocation,
      targetHour: selectedHour,
      dayType: selectedDayType,
      places: comparedVenues as Place[],
      weatherForecasts,
    });
  }, [comparedVenues, userLocation, selectedHour, selectedDayType, weatherForecasts]);

  // Weather at selected hour
  const hourlyWeather = useMemo(() => {
    if (weatherForecasts && weatherForecasts.length > selectedHour) {
      return weatherForecasts[selectedHour];
    }
    return getSyntheticHourlyWeather()[selectedHour] || getSyntheticHourlyWeather()[19];
  }, [weatherForecasts, selectedHour]);

  const congestionFactor = useMemo(() => {
    return getHourCongestionFactor(selectedHour, selectedDayType);
  }, [selectedHour, selectedDayType]);

  // Handle removing a venue from comparison
  const handleRemoveVenue = (venueId: string) => {
    if (comparedVenues.length <= 1) return;
    setComparedVenues((prev) => prev.filter((v) => v.id !== venueId));
  };

  // Handle adding a venue to comparison
  const handleAddVenue = (venue: Place | UnifiedPlace) => {
    if (comparedVenues.some((v) => v.id === venue.id)) return;
    if (comparedVenues.length >= 3) {
      // Replace last one
      setComparedVenues((prev) => [...prev.slice(0, 2), venue]);
    } else {
      setComparedVenues((prev) => [...prev, venue]);
    }
    setIsPickerOpen(false);
    setSearchPickerQuery('');
  };

  // Filter available venues for picker
  const filteredPickerVenues = useMemo(() => {
    const query = searchPickerQuery.trim().toLowerCase();
    return places
      .filter((p) => !comparedVenues.some((cv) => cv.id === p.id))
      .filter((p) => {
        if (!query) return true;
        return (
          p.name.toLowerCase().includes(query) ||
          p.district?.toLowerCase().includes(query) ||
          p.categoryLabel?.toLowerCase().includes(query)
        );
      })
      .slice(0, 10);
  }, [places, comparedVenues, searchPickerQuery]);

  // Generate Smart AI Verdict comparing the options
  const aiVerdict = useMemo(() => {
    if (comparedTrafficResults.length < 2) {
      return {
        winnerTitle: 'Cần ít nhất 2 quán để so sánh',
        fastestVenue: null,
        highestRatedVenue: null,
        safestWeatherVenue: null,
        bestValueVenue: null,
        detailedSummary: 'Hãy thêm quán thứ 2 hoặc thứ 3 để AI phân tích và đưa ra khuyến nghị chuẩn xác.',
      };
    }

    // Fastest ETA
    const fastest = [...comparedTrafficResults].sort(
      (a, b) => a.estimatedDurationMinutes - b.estimatedDurationMinutes
    )[0];

    // Highest Rated
    const highestRated = [...comparedTrafficResults].sort(
      (a, b) => (b.place.rating || 0) - (a.place.rating || 0)
    )[0];

    // Safest from floods & rain
    const safestWeather = [...comparedTrafficResults].sort((a, b) => {
      const riskA = a.weatherFlood?.routeFloodRisk === 'none' ? 0 : a.weatherFlood?.routeFloodRisk === 'low' ? 1 : 2;
      const riskB = b.weatherFlood?.routeFloodRisk === 'none' ? 0 : b.weatherFlood?.routeFloodRisk === 'low' ? 1 : 2;
      return riskA - riskB;
    })[0];

    // Overall Best Value Recommendation
    let bestPick = fastest;
    let reason = '';

    if (hourlyWeather.isRainy && safestWeather.place.id !== fastest.place.id) {
      bestPick = safestWeather;
      reason = `Vì thời tiết lúc ${selectedHour}:00 có mưa (${hourlyWeather.conditionLabel}), tuyến đến ${bestPick.place.name} an toàn nhất, đường khô ráo và chỗ đỗ xe có mái che.`;
    } else if (fastest.trafficScore >= 75) {
      bestPick = fastest;
      reason = `Tuyến đến ${bestPick.place.name} là tối ưu nhất với thời gian đi chỉ ~${bestPick.estimatedDurationMinutes} phút, đường rất thông thoáng và né được các nút giao hay ùn ứ.`;
    } else if (highestRated.place.rating >= 4.7 && highestRated.estimatedDurationMinutes <= fastest.estimatedDurationMinutes + 8) {
      bestPick = highestRated;
      reason = `${bestPick.place.name} có đánh giá rất cao (${bestPick.place.rating}⭐) với chất lượng món ngon chuẩn vị, trong khi thời gian di chuyển chỉ chênh lệch ~${highestRated.estimatedDurationMinutes - fastest.estimatedDurationMinutes} phút so với quán gần nhất.`;
    } else {
      bestPick = fastest;
      reason = `${bestPick.place.name} giúp tiết kiệm tối đa thời gian trên đường (~${bestPick.estimatedDurationMinutes} phút), di chuyển nhẹ nhàng trong khung giờ này.`;
    }

    return {
      winnerTitle: `🏆 Khuyên chọn: ${bestPick.place.name}`,
      winnerVenue: bestPick.place,
      winnerRoute: bestPick,
      fastestVenue: fastest,
      highestRatedVenue: highestRated,
      safestWeatherVenue: safestWeather,
      reason,
      detailedSummary: `Lúc ${selectedHour}:00 (${congestionFactor.description}), lựa chọn phù hợp nhất là "${bestPick.place.name}" để vừa thưởng thức trọn vẹn món ngon, vừa tối ưu thời gian di chuyển mà không lo kẹt xe.`,
    };
  }, [comparedTrafficResults, hourlyWeather, selectedHour, congestionFactor]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
      id="smart-venue-comparator-modal"
    >
      <div
        className="bg-[#FAF9F5] text-[#2D2926] w-full max-w-3xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header */}
        <div className="p-4 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center text-xl shadow-md">
              ⚖️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-sm sm:text-base text-white">
                  So Sánh Quán & Lộ Trình Thông Minh
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Tối ưu theo giờ
                </span>
              </div>
              <p className="text-[11px] text-stone-300">
                Tính toán thời gian tối ưu, né điểm ùn ứ & đường ngập nước
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 2. Top Interactive Settings Bar (Hour, Day Type, Add Venue) */}
        <div className="p-3 bg-white border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Time & Day Config */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#FAF9F5] px-2.5 py-1 rounded-xl border border-stone-200">
              <span className="text-xs">⏰</span>
              <span className="text-xs font-bold text-stone-800">
                Giờ đi: <span className="text-[#FF6B35] font-black">{selectedHour}:00</span>
              </span>
              <input
                type="range"
                min={0}
                max={23}
                step={1}
                value={selectedHour}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
                className="w-20 sm:w-28 h-1.5 bg-stone-300 rounded-lg appearance-none cursor-pointer accent-[#FF6B35] ml-1.5"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#FAF9F5] p-0.5 rounded-xl border border-stone-200 text-xs">
              <button
                type="button"
                onClick={() => setSelectedDayType('weekday')}
                className={`px-2 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedDayType === 'weekday' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600'
                }`}
              >
                Ngày thường
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayType('weekend')}
                className={`px-2 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedDayType === 'weekend' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600'
                }`}
              >
                Cuối tuần
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayType('holiday')}
                className={`px-2 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedDayType === 'holiday' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-600'
                }`}
              >
                Ngày lễ
              </button>
            </div>
          </div>

          {/* Add Venue Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPickerOpen((prev) => !prev)}
              disabled={comparedVenues.length >= 3 && !isPickerOpen}
              className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                comparedVenues.length >= 3
                  ? 'bg-stone-100 text-stone-400 border border-stone-200'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
              }`}
            >
              <span>➕</span>
              <span>Thêm quán ({comparedVenues.length}/3)</span>
            </button>

            {/* Popover Picker */}
            {isPickerOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-stone-200 p-3 z-30 flex flex-col gap-2 animate-fade-in">
                <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
                  <span className="text-xs font-bold text-stone-800">Chọn quán để so sánh</span>
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    className="text-xs text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Tìm tên quán hoặc quận..."
                  value={searchPickerQuery}
                  onChange={(e) => setSearchPickerQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-100 border border-stone-200 text-xs focus:outline-none focus:border-[#FF6B35]"
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto no-scrollbar flex flex-col gap-1">
                  {filteredPickerVenues.length === 0 ? (
                    <span className="text-[11px] text-stone-400 p-2 text-center">
                      Không tìm thấy quán phù hợp
                    </span>
                  ) : (
                    filteredPickerVenues.map((pv) => (
                      <button
                        key={pv.id}
                        type="button"
                        onClick={() => handleAddVenue(pv)}
                        className="p-2 rounded-xl text-left hover:bg-stone-50 transition-colors flex items-center justify-between gap-1.5 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <strong className="text-xs text-stone-800 block truncate">{pv.name}</strong>
                          <span className="text-[10px] text-stone-500 truncate block">
                            {pv.categoryLabel || pv.district} • ⭐ {pv.rating || '4.5'}
                          </span>
                        </div>
                        <span className="text-xs text-emerald-600 font-bold shrink-0">+ Thêm</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Navigation View Modes (Bảng So Sánh | Lộ Trình Né Tắc | AI Kết Luận) */}
        <div className="bg-[#FAF9F5] px-4 pt-2.5 border-b border-stone-200 flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-t-xl text-xs font-heading font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'border-[#FF6B35] text-[#FF6B35] bg-white shadow-2xs'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>📊</span>
            <span>Bảng So Sánh Chi Tiết</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('traffic')}
            className={`px-3 py-1.5 rounded-t-xl text-xs font-heading font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'traffic'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>🚦</span>
            <span>Mô Phỏng Giao Thông & Né Tắc</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai_verdict')}
            className={`px-3 py-1.5 rounded-t-xl text-xs font-heading font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ai_verdict'
                ? 'border-amber-500 text-amber-800 bg-white shadow-2xs'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>🤖</span>
            <span>AI Tổng Kết & Khuyên Chọn</span>
          </button>
        </div>

        {/* 4. Main Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* TAB 1: MATRIX COMPARISON TABLE */}
          {activeTab === 'matrix' && (
            <div className="flex flex-col gap-4">
              {/* Cards Grid Side-by-Side */}
              <div className={`grid grid-cols-1 ${comparedTrafficResults.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3`}>
                {comparedTrafficResults.map((tr, idx) => {
                  const place = tr.place;
                  const isWinner = aiVerdict.winnerVenue?.id === place.id;
                  const weatherFlood = tr.weatherFlood;
                  const hasFloodRisk =
                    weatherFlood &&
                    (weatherFlood.routeFloodRisk === 'high_flood' || weatherFlood.routeFloodRisk === 'moderate');

                  return (
                    <div
                      key={place.id || idx}
                      className={`bg-white rounded-2xl p-3.5 border flex flex-col gap-3 shadow-xs transition-all relative ${
                        isWinner
                          ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {/* Top Badge (Winner or Position) */}
                      <div className="flex items-center justify-between gap-1">
                        {isWinner ? (
                          <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-heading font-black shadow-2xs">
                            ⭐ AI KHUYÊN CHỌN
                          </span>
                        ) : (
                          <span className="text-[11px] font-heading font-bold text-stone-500">
                            Lựa chọn #{idx + 1}
                          </span>
                        )}

                        {comparedVenues.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVenue(place.id)}
                            className="w-6 h-6 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center text-xs transition-colors cursor-pointer"
                            title="Xóa quán khỏi bảng so sánh"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Venue Identity Header */}
                      <div className="flex items-start gap-2.5">
                        <img
                          src={place.imageUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400'}
                          alt={place.name}
                          className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-heading font-bold text-sm text-stone-900 leading-snug truncate">
                            {place.name}
                          </h4>
                          <p className="text-[11px] text-stone-500 truncate mt-0.5">
                            {place.categoryLabel || place.district}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-amber-500 text-xs">⭐</span>
                            <span className="text-xs font-bold text-stone-800">{place.rating || '4.6'}</span>
                            <span className="text-[10px] text-stone-400">({place.reviewCount || 45})</span>
                          </div>
                        </div>
                      </div>

                      {/* Traffic & ETA Key Indicator */}
                      <div
                        className={`p-2.5 rounded-xl border flex flex-col gap-1 ${
                          tr.trafficLevel === 'smooth'
                            ? 'bg-emerald-50 border-emerald-200'
                            : tr.trafficLevel === 'moderate'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-rose-50 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-stone-700">
                            ⏱️ Thời gian đi lúc {selectedHour}:00:
                          </span>
                          <span
                            className={`font-heading font-black text-sm ${
                              tr.trafficLevel === 'smooth'
                                ? 'text-emerald-700'
                                : tr.trafficLevel === 'moderate'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            ~{tr.estimatedDurationMinutes} phút
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="text-stone-600">Khoảng cách:</span>
                          <span className="font-semibold text-stone-800">{tr.distanceKmFormatted}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="text-stone-600">Độ thông thoáng:</span>
                          <span className="font-bold text-stone-800">{tr.trafficLabel}</span>
                        </div>
                        {tr.delayMinutes > 0 ? (
                          <span className="text-[10px] text-amber-800 font-semibold bg-amber-100/60 px-1.5 py-0.5 rounded">
                            ⚠️ Bị delay +{tr.delayMinutes} phút do kẹt xe
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/60 px-1.5 py-0.5 rounded">
                            ✓ Không bị delay, đường rất êm
                          </span>
                        )}
                      </div>

                      {/* Comparison Metrics Grid */}
                      <div className="grid grid-cols-1 gap-1.5 text-xs text-stone-700 border-t border-stone-100 pt-2">
                        {/* Price Band */}
                        <div className="flex items-center justify-between py-1 border-b border-stone-100/80">
                          <span className="text-stone-500 text-[11px]">💵 Mức giá:</span>
                          <strong className="text-stone-900 font-semibold">{place.priceBand || '35k - 65k'}</strong>
                        </div>

                        {/* Rain & Flood Safety */}
                        <div className="flex items-center justify-between py-1 border-b border-stone-100/80">
                          <span className="text-stone-500 text-[11px]">🌧️ Tránh ngập lụt:</span>
                          <span
                            className={`font-semibold text-[11px] px-1.5 py-0.2 rounded-md ${
                              hasFloodRisk
                                ? 'bg-rose-100 text-rose-800 font-bold'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {hasFloodRisk ? '⚠️ Nguy cơ ngập' : '🛡️ Cao ráo, an toàn'}
                          </span>
                        </div>

                        {/* Opening & Space */}
                        <div className="flex items-center justify-between py-1 border-b border-stone-100/80">
                          <span className="text-stone-500 text-[11px]">🪑 Chỗ ngồi & Xe:</span>
                          <span className="text-stone-800 font-medium text-[11px] text-right truncate max-w-[130px]">
                            {weatherFlood?.smartDiningAdvice || 'Máy lạnh, vỉa hè'}
                          </span>
                        </div>

                        {/* Quest XP */}
                        <div className="flex items-center justify-between py-1">
                          <span className="text-stone-500 text-[11px]">🎁 Thưởng Quest:</span>
                          <span className="text-[#FF6B35] font-bold text-[11px]">
                            +50 XP Check-in
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-1 mt-auto flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectDestination(place, tr)}
                          className={`w-full py-2.5 rounded-xl font-heading text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs ${
                            isWinner
                              ? 'bg-gradient-to-r from-[#FF6B35] to-orange-600 text-white shadow-orange-500/20'
                              : 'bg-stone-900 hover:bg-stone-800 text-white'
                          }`}
                        >
                          <span>Chọn quán này</span>
                          <span>→</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const url = buildGoogleMapsDirectionsUrl({
                              name: place.name,
                              address: place.address,
                              latitude: place.latitude,
                              longitude: place.longitude,
                            });
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          className="w-full py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-heading text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Mở Google Maps</span>
                          <span>↗</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: TRAFFIC & ROUTE OPTIMIZER */}
          {activeTab === 'traffic' && (
            <div className="flex flex-col gap-3.5">
              {/* Traffic Condition Overview Card */}
              <div className="bg-gradient-to-r from-emerald-900 to-stone-900 text-white p-4 rounded-2xl flex flex-col gap-2 border border-emerald-700/50 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚦</span>
                    <div>
                      <h4 className="font-heading font-bold text-sm text-white">
                        Dự báo giao thông lúc {selectedHour}:00 ({selectedDayType === 'weekday' ? 'Ngày thường' : selectedDayType === 'weekend' ? 'Cuối tuần' : 'Ngày lễ'})
                      </h4>
                      <p className="text-[11.5px] text-emerald-200">{congestionFactor.description}</p>
                    </div>
                  </div>
                  <span className="bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs px-2.5 py-1 rounded-full font-mono font-bold">
                    Hệ số: {congestionFactor.factor}x
                  </span>
                </div>

                {/* Weather & Flood Snapshot */}
                <div className="bg-white/10 p-2.5 rounded-xl text-xs text-stone-200 flex items-center justify-between gap-2 border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{hourlyWeather.conditionIcon}</span>
                    <span>
                      <strong>Thời tiết:</strong> {hourlyWeather.conditionLabel} ({hourlyWeather.temperatureC}°C) • Mưa {hourlyWeather.precipitationProbability}%
                    </span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-mono text-stone-200">
                    Radar ECMWF Live
                  </span>
                </div>
              </div>

              {/* Step-by-Step Route Comparison List */}
              <div className="flex flex-col gap-3">
                {comparedTrafficResults.map((tr, idx) => (
                  <div
                    key={tr.place.id || idx}
                    className="bg-white rounded-2xl p-4 border border-stone-200 flex flex-col gap-2.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white ${
                            tr.trafficLevel === 'smooth'
                              ? 'bg-emerald-600'
                              : tr.trafficLevel === 'moderate'
                              ? 'bg-amber-600'
                              : 'bg-rose-600'
                          }`}
                        >
                          #{idx + 1}
                        </div>
                        <div>
                          <strong className="text-sm font-bold text-stone-900 block">{tr.place.name}</strong>
                          <span className="text-xs text-stone-500">
                            {tr.distanceKmFormatted} • {tr.trafficLabel}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-heading font-black text-emerald-700 block">
                          ~{tr.estimatedDurationMinutes} phút
                        </span>
                        {tr.delayMinutes > 0 && (
                          <span className="text-[10px] text-amber-600 font-semibold">
                            + {tr.delayMinutes}p do ùn tắc
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottlenecks Avoided */}
                    <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-100 text-xs flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-stone-700">
                        <span>💡 <strong>Lời khuyên né kẹt xe:</strong></span>
                        <span>{tr.smartAdvice}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-800 font-semibold pt-0.5">
                        <span>🚀 <strong>Thời điểm xuất phát tốt nhất:</strong></span>
                        <span>{tr.bestDepartureTimeAdvice}</span>
                      </div>
                      {tr.avoidedBottlenecks.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-stone-600">
                          <span>🛡️ <strong>Tuyến né được:</strong></span>
                          {tr.avoidedBottlenecks.map((bn, bIdx) => (
                            <span
                              key={bIdx}
                              className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-medium"
                            >
                              {bn}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectDestination(tr.place, tr)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading text-xs font-bold transition-all cursor-pointer"
                      >
                        Xem Lộ Trình Này Trên Bản Đồ →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: AI VERDICT & SMART RECOMMENDATION */}
          {activeTab === 'ai_verdict' && (
            <div className="flex flex-col gap-3.5">
              {/* Winner Highlight Box */}
              <div className="bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-500/5 border-2 border-amber-400 rounded-3xl p-4 sm:p-5 flex flex-col gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <span className="text-[11px] font-heading font-black text-amber-800 uppercase tracking-wider">
                      KẾT QUẢ PHÂN TÍCH TỐI ƯU TOÀN DIỆN
                    </span>
                    <h3 className="font-heading font-bold text-base sm:text-lg text-stone-900">
                      {aiVerdict.winnerTitle}
                    </h3>
                  </div>
                </div>

                <p className="text-xs sm:text-[13px] text-stone-800 leading-relaxed font-medium bg-white/80 p-3 rounded-2xl border border-amber-200/80">
                  {aiVerdict.reason}
                </p>

                {aiVerdict.winnerVenue && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-stone-600">
                      Thời gian dự tính: <strong>~{aiVerdict.winnerRoute?.estimatedDurationMinutes} phút</strong> ({aiVerdict.winnerRoute?.distanceKmFormatted})
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectDestination(aiVerdict.winnerVenue!, aiVerdict.winnerRoute)}
                      className="px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-orange-600 text-white font-heading text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      Lên Đường Đến {aiVerdict.winnerVenue.name} 🚀
                    </button>
                  </div>
                )}
              </div>

              {/* Categorized Awards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Fastest */}
                <div className="bg-white p-3 rounded-2xl border border-emerald-200 flex flex-col gap-1 shadow-xs">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                    <span>⚡ NHANH NHẤT:</span>
                  </span>
                  <strong className="text-xs text-stone-900 truncate">
                    {aiVerdict.fastestVenue?.place.name || '---'}
                  </strong>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    ~{aiVerdict.fastestVenue?.estimatedDurationMinutes} phút di chuyển
                  </span>
                </div>

                {/* Highest Rated */}
                <div className="bg-white p-3 rounded-2xl border border-amber-200 flex flex-col gap-1 shadow-xs">
                  <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                    <span>⭐ NGON & REVIEW CAO:</span>
                  </span>
                  <strong className="text-xs text-stone-900 truncate">
                    {aiVerdict.highestRatedVenue?.place.name || '---'}
                  </strong>
                  <span className="text-[11px] text-amber-700 font-semibold">
                    ⭐ {aiVerdict.highestRatedVenue?.place.rating || '4.8'} ({aiVerdict.highestRatedVenue?.place.reviewCount || 50} đánh giá)
                  </span>
                </div>

                {/* Safest Weather */}
                <div className="bg-white p-3 rounded-2xl border border-blue-200 flex flex-col gap-1 shadow-xs">
                  <span className="text-xs font-bold text-blue-800 flex items-center gap-1">
                    <span>🛡️ TRÁNH NGẬP LỤT:</span>
                  </span>
                  <strong className="text-xs text-stone-900 truncate">
                    {aiVerdict.safestWeatherVenue?.place.name || '---'}
                  </strong>
                  <span className="text-[11px] text-blue-700 font-semibold">
                    Lộ trình vùng cao, an toàn
                  </span>
                </div>
              </div>

              {/* Detailed Summary */}
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200 text-xs text-stone-600 leading-relaxed">
                <span className="font-bold text-stone-800 block mb-1">📝 Ghi chú tổng hợp:</span>
                {aiVerdict.detailedSummary}
              </div>
            </div>
          )}
        </div>

        {/* 5. Footer */}
        <div className="p-3.5 bg-[#FAF9F5] border-t border-stone-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-stone-500">
            Đang so sánh <strong>{comparedVenues.length} quán</strong> lúc <strong>{selectedHour}:00</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white font-heading text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
