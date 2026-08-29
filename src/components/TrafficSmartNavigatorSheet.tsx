/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Place } from '../types';
import {
  DayType,
  TrafficRouteResult,
  analyzeTrafficRoutes,
  getHourCongestionFactor,
} from '../services/maps/trafficSmartRoutingService';
import {
  HourlyWeatherForecast,
  fetchLiveWeatherForecast,
  getSyntheticHourlyWeather,
} from '../services/maps/weatherFloodService';

interface TrafficSmartNavigatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  userLocation: { latitude: number; longitude: number };
  onSelectRoute: (result: TrafficRouteResult) => void;
  selectedRouteResult?: TrafficRouteResult | null;
  onOpenComparator?: (initialVenues?: Place[]) => void;
}

export const TrafficSmartNavigatorSheet: React.FC<TrafficSmartNavigatorSheetProps> = ({
  isOpen,
  onClose,
  places,
  userLocation,
  onSelectRoute,
  selectedRouteResult,
  onOpenComparator,
}) => {
  // Current real-world hour as initial default
  const currentRealHour = new Date().getHours();
  const [selectedHour, setSelectedHour] = useState<number>(
    currentRealHour >= 18 && currentRealHour <= 20 ? currentRealHour : 20
  );
  const [selectedDayType, setSelectedDayType] = useState<DayType>('weekday');
  const [filterLevel, setFilterLevel] = useState<'all' | 'smooth' | 'dry_safe' | 'near'>('all');
  const [weatherForecasts, setWeatherForecasts] = useState<HourlyWeatherForecast[]>(() =>
    getSyntheticHourlyWeather()
  );
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Fetch official live weather forecast
  useEffect(() => {
    let isMounted = true;
    if (userLocation?.latitude && userLocation?.longitude) {
      setIsLoadingWeather(true);
      fetchLiveWeatherForecast(userLocation.latitude, userLocation.longitude)
        .then((data) => {
          if (isMounted && data && data.length > 0) {
            setWeatherForecasts(data);
          }
        })
        .catch((err) => {
          console.warn('Weather fetch error:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingWeather(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [userLocation?.latitude, userLocation?.longitude]);

  // Current selected hour weather
  const currentHourWeather = useMemo(() => {
    return weatherForecasts[selectedHour] || weatherForecasts[20] || getSyntheticHourlyWeather()[20];
  }, [weatherForecasts, selectedHour]);

  // Compute traffic & flood analysis
  const trafficResults = useMemo(() => {
    return analyzeTrafficRoutes({
      userLocation,
      targetHour: selectedHour,
      dayType: selectedDayType,
      places,
      weatherForecasts,
    });
  }, [userLocation, selectedHour, selectedDayType, places, weatherForecasts]);

  // Congestion forecast overview
  const congestionInfo = useMemo(() => {
    return getHourCongestionFactor(selectedHour, selectedDayType);
  }, [selectedHour, selectedDayType]);

  // Filtered list
  const displayResults = useMemo(() => {
    let list = trafficResults;
    if (filterLevel === 'smooth') {
      list = list.filter((r) => r.trafficLevel === 'smooth');
    } else if (filterLevel === 'dry_safe') {
      list = list.filter(
        (r) => !r.weatherFlood || r.weatherFlood.routeFloodRisk === 'none' || r.weatherFlood.routeFloodRisk === 'low'
      );
    } else if (filterLevel === 'near') {
      list = [...list].sort((a, b) => a.distanceMeters - b.distanceMeters);
    }
    return list.slice(0, 15);
  }, [trafficResults, filterLevel]);

  if (!isOpen) return null;

  const quickHours = [
    { hour: currentRealHour, label: 'Ngay bây giờ', icon: '⚡' },
    { hour: 12, label: '12:00 Trưa', icon: '☀️' },
    { hour: 18, label: '18:00 Tan tầm', icon: '🚗' },
    { hour: 20, label: '20:00 (8h tối)', icon: '🌙' },
    { hour: 22, label: '22:00 Đêm', icon: '✨' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF9F5] text-[#2D2926] w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl border border-[#2D2926]/10 animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 bg-[#1C1917] text-white flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-lg shadow-xs">
              🚦
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-heading font-bold text-sm text-white">
                  Né Tắc Đường & Cảnh Báo Mưa Ngập
                </h3>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/40">
                  Radar AI Live
                </span>
              </div>
              <p className="text-[10.5px] text-stone-300">
                Dự báo lưu lượng, thời tiết và cảnh báo điểm ngập chính xác
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

        {/* Interactive Controls Area */}
        <div className="p-3.5 bg-white border-b border-[#2D2926]/5 flex flex-col gap-2.5">
          {/* Day Type Selector */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#594139] shrink-0">
              📅 Ngày di chuyển:
            </span>
            <div className="flex items-center gap-1 bg-[#FAF9F5] p-1 rounded-xl border border-[#2D2926]/5 flex-1 justify-end">
              <button
                type="button"
                onClick={() => setSelectedDayType('weekday')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedDayType === 'weekday'
                    ? 'bg-[#1C1917] text-white shadow-xs'
                    : 'text-[#8D7168] hover:text-[#2D2926]'
                }`}
              >
                Ngày thường
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayType('weekend')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedDayType === 'weekend'
                    ? 'bg-[#1C1917] text-white shadow-xs'
                    : 'text-[#8D7168] hover:text-[#2D2926]'
                }`}
              >
                Cuối tuần
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayType('holiday')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedDayType === 'holiday'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-[#8D7168] hover:text-[#2D2926]'
                }`}
              >
                🎉 Ngày Lễ
              </button>
            </div>
          </div>

          {/* Quick Hour Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#594139]">
                ⏰ Khung giờ muốn đi: <span className="text-[#FF6B35] font-black">{selectedHour}:00</span>
              </span>
              <span className="text-[10px] text-[#8D7168]">
                Kéo thanh trượt để xem giờ khác
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {quickHours.map((qh) => {
                const hourW = weatherForecasts[qh.hour] || getSyntheticHourlyWeather()[qh.hour];
                return (
                  <button
                    key={qh.label}
                    type="button"
                    onClick={() => setSelectedHour(qh.hour)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium border flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                      selectedHour === qh.hour
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs font-bold scale-102'
                        : 'bg-[#FAF9F5] border-[#2D2926]/10 text-[#594139] hover:bg-stone-100'
                    }`}
                  >
                    <span>{qh.icon}</span>
                    <span>{qh.label}</span>
                    {hourW && (
                      <span className={`text-[10px] px-1 py-0.2 rounded font-normal ${
                        selectedHour === qh.hour ? 'bg-emerald-700 text-emerald-100' : 'bg-stone-200/70 text-stone-600'
                      }`}>
                        {hourW.conditionIcon} {hourW.temperatureC}°
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Slider for exact hours */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[10px] text-stone-400 font-mono">00:00</span>
              <input
                type="range"
                min={0}
                max={23}
                step={1}
                value={selectedHour}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <span className="text-[10px] text-stone-400 font-mono">23:00</span>
            </div>
          </div>

          {/* 🌧️ Weather & Flood Live Radar Status Card */}
          <div
            className={`p-2.5 rounded-2xl border flex flex-col gap-1.5 transition-all ${
              currentHourWeather.isRainy || currentHourWeather.rainSeverity === 'heavy_storm'
                ? 'bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border-blue-200'
                : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50/50 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${
                    currentHourWeather.isRainy ? 'bg-blue-500 text-white shadow-xs' : 'bg-amber-400 text-stone-900 shadow-xs'
                  }`}
                >
                  {currentHourWeather.conditionIcon}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-xs font-bold text-stone-900 truncate">
                      Lúc {selectedHour}:00: {currentHourWeather.conditionLabel}
                    </strong>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white/90 border border-stone-200 text-stone-700 shrink-0">
                      {currentHourWeather.temperatureC}°C
                    </span>
                  </div>
                  <span className="text-[10.5px] text-stone-600 truncate">
                    Khả năng mưa: <strong className="text-stone-800">{currentHourWeather.precipitationProbability}%</strong> • Lượng mưa: {currentHourWeather.precipitationMm > 0 ? `${currentHourWeather.precipitationMm} mm/h` : '0 mm (Khô ráo)'}
                  </span>
                </div>
              </div>

              {/* Source Tag */}
              <div className="text-[9px] text-stone-500 font-mono bg-white/80 px-1.5 py-0.5 rounded-md border border-stone-200 shrink-0 flex items-center gap-1">
                {isLoadingWeather ? (
                  <span>Đang tải...</span>
                ) : (
                  <>
                    <span>📡</span>
                    <span>Radar ECMWF</span>
                  </>
                )}
              </div>
            </div>

            {/* Weather + Traffic Advice text */}
            <div className="text-[11px] text-stone-700 bg-white/80 p-1.5 rounded-xl border border-stone-200/60 leading-tight">
              💡 <strong>Lời khuyên lúc {selectedHour}:00:</strong> {currentHourWeather.advice}
            </div>
          </div>

          {/* Sub Filter Chips */}
          <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setFilterLevel('all')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                filterLevel === 'all'
                  ? 'bg-[#2D2926] text-white shadow-xs'
                  : 'bg-[#FAF9F5] text-[#8D7168] hover:text-[#2D2926]'
              }`}
            >
              Tất cả ({trafficResults.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('dry_safe')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                filterLevel === 'dry_safe'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              <span>🛡️</span>
              <span>An toàn không ngập nước ({trafficResults.filter((r) => !r.weatherFlood || r.weatherFlood.routeFloodRisk === 'none' || r.weatherFlood.routeFloodRisk === 'low').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('smooth')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                filterLevel === 'smooth'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <span>🟢</span>
              <span>Đường cực thoáng ({trafficResults.filter((r) => r.trafficLevel === 'smooth').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('near')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                filterLevel === 'near'
                  ? 'bg-[#2D2926] text-white shadow-xs'
                  : 'bg-[#FAF9F5] text-[#8D7168] hover:text-[#2D2926]'
              }`}
            >
              Gần nhất
            </button>
          </div>
        </div>

        {/* Scrollable Results List */}
        <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5 max-h-[42vh]">
          {displayResults.length === 0 ? (
            <div className="py-8 text-center text-stone-400 text-xs">
              Không có quán phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            displayResults.map((result) => {
              const isSelected = selectedRouteResult?.place?.id === result.place?.id;
              const weatherFlood = result.weatherFlood;
              const hasFloodRisk = weatherFlood && (weatherFlood.routeFloodRisk === 'high_flood' || weatherFlood.routeFloodRisk === 'moderate');

              return (
                <div
                  key={result.place?.id}
                  onClick={() => onSelectRoute(result)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                      : hasFloodRisk
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                      : 'bg-white border-[#2D2926]/10 hover:border-emerald-300 hover:shadow-xs'
                  }`}
                >
                  {/* Top Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          hasFloodRisk
                            ? 'bg-rose-600 text-white shadow-xs'
                            : result.trafficLevel === 'smooth'
                            ? 'bg-emerald-500 text-white'
                            : result.trafficLevel === 'moderate'
                            ? 'bg-amber-500 text-white'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {hasFloodRisk ? '⚠️' : result.trafficScore}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-xs font-bold text-[#2D2926] truncate">
                            {result.place?.name}
                          </strong>
                          {hasFloodRisk && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200 shrink-0">
                              Nguy cơ ngập
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#8D7168] truncate">
                          {result.place?.category || 'Quán ăn'} • {result.distanceKmFormatted}
                        </span>
                      </div>
                    </div>

                    {/* ETA Badge */}
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-heading font-black text-emerald-700">
                          ~{result.estimatedDurationMinutes} phút
                        </span>
                      </div>
                      {result.delayMinutes > 0 ? (
                        <span className="text-[9.5px] text-amber-700 font-medium">
                          + {result.delayMinutes}p do kẹt xe/mưa
                        </span>
                      ) : (
                        <span className="text-[9.5px] text-emerald-600 font-bold">
                          ✓ Đường thẳng băng
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Traffic Analysis & Smart Advice */}
                  <div className="p-2 rounded-xl bg-[#FAF9F5] border border-[#2D2926]/5 flex flex-col gap-1 text-[10.5px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#594139]">
                        {result.trafficLabel}
                      </span>
                      {result.avoidedBottlenecks.length > 0 && (
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 font-semibold">
                          {result.avoidedBottlenecks[0]}
                        </span>
                      )}
                    </div>
                    <p className="text-[#8D7168] leading-tight">
                      💡 {result.smartAdvice}
                    </p>

                    {/* Dining & Parking Advice (Indoor / Outdoor / Parking) */}
                    {weatherFlood && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 border-t border-stone-200/60 text-[10px]">
                        <span className="text-stone-700">
                          🪑 <strong>Chỗ ngồi:</strong> {weatherFlood.smartDiningAdvice}
                        </span>
                        <span className="text-stone-700">
                          🅿️ <strong>Gửi xe:</strong> {weatherFlood.parkingAdvice}
                        </span>
                      </div>
                    )}

                    <div className="text-emerald-800 font-semibold flex items-center gap-1 pt-0.5">
                      <span>🚀 Mẹo xuất phát:</span>
                      <span>{result.bestDepartureTimeAdvice}</span>
                    </div>
                  </div>

                  {/* Select Route Action */}
                  <div className="flex items-center justify-between pt-0.5 gap-2">
                    {onOpenComparator && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onOpenComparator([result.place]);
                        }}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-heading font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>⚖️</span>
                        <span>So sánh quán này</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ml-auto ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-[#2D2926] text-white hover:bg-stone-800'
                      }`}
                    >
                      {isSelected ? '✓ Đang xem' : 'Xem đường đi →'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Bottom Bar */}
        <div className="p-3 bg-[#FAF9F5] border-t border-[#2D2926]/10 flex items-center justify-between gap-2">
          {onOpenComparator ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenComparator(displayResults.slice(0, 3).map((r) => r.place));
              }}
              className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-heading font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <span>⚖️</span>
              <span>So sánh top quán</span>
            </button>
          ) : (
            <span className="text-[11px] text-[#8D7168]">
              Đã phân tích lúc <strong className="text-[#2D2926]">{selectedHour}:00 ({currentHourWeather.conditionLabel})</strong>
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-[#1C1917] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-stone-800 cursor-pointer ml-auto"
          >
            Đóng & Xem Bản Đồ
          </button>
        </div>
      </div>
    </div>
  );
};

