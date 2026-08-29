/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getDistance } from 'geolib';
import { Place } from '../types';

interface BiteRouletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  savedPlaceIds?: string[];
  userLocation?: { latitude: number; longitude: number } | null;
  onSelectPlace: (place: Place) => void;
}

type DistancePreset = 500 | 1000 | 3000 | 5000;

interface CategoryOption {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  sublabel: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: 'ALL', label: 'Tất cả', shortLabel: 'Tất cả', icon: '✨', sublabel: 'Mọi món ngon' },
  { id: 'FOOD', label: 'Đồ ăn', shortLabel: 'Đồ ăn', icon: '🍜', sublabel: 'Phở, bún, mì, lẩu, nướng...' },
  { id: 'DRINK', label: 'Trà & Nước', shortLabel: 'Trà / Nước', icon: '🧋', sublabel: 'Trà sữa, nước ép, trà trái cây' },
  { id: 'COFFEE', label: 'Cà phê', shortLabel: 'Cà phê', icon: '☕', sublabel: 'Cà phê view đẹp, làm việc' },
  { id: 'SNACK', label: 'Ăn vặt', shortLabel: 'Ăn vặt', icon: '🍰', sublabel: 'Bánh ngọt, chè, nem rán' },
  { id: 'RICE', label: 'Cơm & Bữa chính', shortLabel: 'Cơm', icon: '🍱', sublabel: 'Cơm tấm, cơm văn phòng' },
  { id: 'FAST_FOOD', label: 'Fast food', shortLabel: 'Fast food', icon: '🍔', sublabel: 'Burger, gà rán, pizza' },
  { id: 'ASIAN', label: 'Nhật / Hàn / Á', shortLabel: 'Nhật/Hàn', icon: '🍣', sublabel: 'Sushi, ramen, BBQ' },
  { id: 'VIETNAMESE', label: 'Món Việt', shortLabel: 'Món Việt', icon: '🥘', sublabel: 'Bún chả, bánh mì, đặc sản' },
];

const DISTANCE_PRESETS: { value: DistancePreset; label: string; sub: string }[] = [
  { value: 500, label: '500m', sub: 'Đi bộ ~6p' },
  { value: 1000, label: '1 km', sub: 'Rất gần' },
  { value: 3000, label: '3 km', sub: 'Tiện đường' },
  { value: 5000, label: '5 km', sub: 'Rộng hơn' },
];

export const BiteRouletteModal: React.FC<BiteRouletteModalProps> = ({
  isOpen,
  onClose,
  places,
  savedPlaceIds = [],
  userLocation,
  onSelectPlace,
}) => {
  // Mode selection: 'AUTO' (BiteQuest pick) vs 'SHORTLIST' (Pick from my saved / selected list)
  const [pickerMode, setPickerMode] = useState<'AUTO' | 'SHORTLIST'>('AUTO');
  const [selectedRadius, setSelectedRadius] = useState<number>(3000);
  const [isCustomRadius, setIsCustomRadius] = useState<boolean>(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['ALL']);
  const [selectedShortlistIds, setSelectedShortlistIds] = useState<string[]>([]);
  
  // Rolling states
  const [isRolling, setIsRolling] = useState(false);
  const [rollPhase, setRollPhase] = useState<'IDLE' | 'STARTING' | 'FAST_SPIN' | 'DECELERATING' | 'LANDING'>('IDLE');
  const [rollingCandidateName, setRollingCandidateName] = useState<string>('');
  const [activeDiceEmoji, setActiveDiceEmoji] = useState<string>('🎲');
  const [rollProgressPercent, setRollProgressPercent] = useState<number>(0);
  const [winnerPlace, setWinnerPlace] = useState<Place | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [excludedWinnerIds, setExcludedWinnerIds] = useState<string[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);

  // Timers ref for clean unmount & cancel
  const timersRef = React.useRef<NodeJS.Timeout[]>([]);
  const animFrameRef = React.useRef<number | null>(null);

  const clearAllRollTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Safe sound synthesizer (Web Audio API)
  const playTickSound = useCallback((freq: number = 480, durationMs: number = 40) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (durationMs + 20) / 1000);
    } catch {
      // Audio autoplay policy fallback
    }
  }, []);

  const playLandingChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.035, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
      });
    } catch {
      // Audio fallback
    }
  }, []);

  // Initialize shortlist with saved places when opened
  useEffect(() => {
    if (isOpen) {
      if (savedPlaceIds.length > 0) {
        setSelectedShortlistIds(savedPlaceIds);
      } else {
        setSelectedShortlistIds(places.slice(0, 5).map((p) => p.id));
      }
      clearAllRollTimers();
      setIsRolling(false);
      setRollPhase('IDLE');
      setIsRevealed(false);
      setWinnerPlace(null);
      setRoundNumber(1);
      setExcludedWinnerIds([]);
      setRollProgressPercent(0);
    }
    return () => {
      clearAllRollTimers();
    };
  }, [isOpen, savedPlaceIds, places, clearAllRollTimers]);

  // Fallback center if userLocation is not ready
  const centerLocation = useMemo(() => {
    if (userLocation) return userLocation;
    if (places.length > 0) {
      return { latitude: places[0].latitude, longitude: places[0].longitude };
    }
    return { latitude: 21.0285, longitude: 105.8542 }; // Hanoi default
  }, [userLocation, places]);

  // Helper to categorize a place
  const matchesCategories = useCallback((place: Place, selectedCatIds: string[]): boolean => {
    if (selectedCatIds.includes('ALL') || selectedCatIds.length === 0) return true;
    
    const cat = (place.category || '').toLowerCase();
    const name = (place.name || '').toLowerCase();
    const label = (place.categoryLabel || '').toLowerCase();

    for (const catId of selectedCatIds) {
      switch (catId) {
        case 'FOOD':
          if (
            cat.includes('pho') ||
            cat.includes('noodle') ||
            cat.includes('rice') ||
            cat.includes('hotpot') ||
            cat.includes('bbq') ||
            cat.includes('restaurant') ||
            name.includes('bún') ||
            name.includes('phở') ||
            name.includes('mì') ||
            name.includes('cơm') ||
            name.includes('lẩu') ||
            name.includes('nướng')
          ) return true;
          break;
        case 'DRINK':
          if (
            cat.includes('drink') ||
            name.includes('trà') ||
            name.includes('tea') ||
            name.includes('sữa') ||
            name.includes('nước') ||
            name.includes('juice')
          ) return true;
          break;
        case 'COFFEE':
          if (
            cat.includes('cafe') ||
            cat.includes('coffee') ||
            name.includes('cà phê') ||
            name.includes('cafe') ||
            name.includes('coffee')
          ) return true;
          break;
        case 'SNACK':
          if (
            cat.includes('bakery') ||
            cat.includes('dessert') ||
            cat.includes('street_food') ||
            name.includes('bánh') ||
            name.includes('chè') ||
            name.includes('nem') ||
            name.includes('vặt')
          ) return true;
          break;
        case 'RICE':
          if (
            cat.includes('rice') ||
            name.includes('cơm') ||
            name.includes('tấm') ||
            name.includes('niêu')
          ) return true;
          break;
        case 'FAST_FOOD':
          if (
            cat.includes('fast_food') ||
            name.includes('burger') ||
            name.includes('pizza') ||
            name.includes('gà rán') ||
            name.includes('fast food')
          ) return true;
          break;
        case 'ASIAN':
          if (
            name.includes('sushi') ||
            name.includes('ramen') ||
            name.includes('tokbokki') ||
            name.includes('nhật') ||
            name.includes('hàn') ||
            name.includes('dimsum') ||
            name.includes('bbq')
          ) return true;
          break;
        case 'VIETNAMESE':
          if (
            cat.includes('pho') ||
            cat.includes('noodle') ||
            name.includes('phở') ||
            name.includes('bún') ||
            name.includes('bánh mì') ||
            name.includes('chả cá') ||
            name.includes('bánh xèo') ||
            name.includes('cơm tấm')
          ) return true;
          break;
      }
    }
    return false;
  }, []);

  // Compute eligible candidate pool
  const candidatePool = useMemo(() => {
    if (places.length === 0) return [];

    let pool = places;

    if (pickerMode === 'SHORTLIST') {
      if (selectedShortlistIds.length > 0) {
        pool = places.filter((p) => selectedShortlistIds.includes(p.id));
      }
    } else {
      // 1. Filter by radius
      pool = pool.filter((p) => {
        const distance = getDistance(centerLocation, {
          latitude: p.latitude,
          longitude: p.longitude,
        });
        return distance <= selectedRadius;
      });

      // 2. Filter by categories
      pool = pool.filter((p) => matchesCategories(p, selectedCategories));
    }

    // 3. Exclude previous winners of current session if we have enough options
    const unselectedPool = pool.filter((p) => !excludedWinnerIds.includes(p.id));
    return unselectedPool.length > 0 ? unselectedPool : pool;
  }, [
    places,
    pickerMode,
    selectedShortlistIds,
    centerLocation,
    selectedRadius,
    selectedCategories,
    matchesCategories,
    excludedWinnerIds,
  ]);

  // Toggle category handler
  const handleToggleCategory = (catId: string) => {
    if (catId === 'ALL') {
      setSelectedCategories(['ALL']);
      return;
    }

    let next = selectedCategories.filter((c) => c !== 'ALL');
    if (next.includes(catId)) {
      next = next.filter((c) => c !== catId);
    } else {
      next.push(catId);
    }

    if (next.length === 0) {
      next = ['ALL'];
    }
    setSelectedCategories(next);
  };

  // Toggle shortlist place
  const handleToggleShortlist = (placeId: string) => {
    if (selectedShortlistIds.includes(placeId)) {
      if (selectedShortlistIds.length > 1) {
        setSelectedShortlistIds((prev) => prev.filter((id) => id !== placeId));
      }
    } else {
      setSelectedShortlistIds((prev) => [...prev, placeId]);
    }
  };

  // Execute the 3.0-second Choreographed Dice Roll
  const handleRollDice = () => {
    if (isRolling || candidatePool.length === 0) return;

    clearAllRollTimers();
    setIsRolling(true);
    setIsRevealed(false);
    setRollPhase('STARTING');
    setRollProgressPercent(0);

    // Pre-calculate the winner immediately from candidate pool
    const chosen = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    const chosenName = chosen.name;

    const diceEmojiList = ['🎲', '🍜', '☕', '🍱', '🍣', '🎯', '🍔', '🥘', '✨'];
    const startTime = Date.now();
    const totalDurationMs = 3000; // Exact 3.0s target timeline

    // 0.0s Initial tactile tick
    playTickSound(380, 50);

    // Progress bar smooth animation frame (0% -> 100% over 3000ms)
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / totalDurationMs) * 100));
      setRollProgressPercent(progress);
      if (elapsed < totalDurationMs) {
        animFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };
    animFrameRef.current = requestAnimationFrame(updateProgress);

    // Phase 1: 0.0s – 0.4s (Immediate Button feedback, Gentle Wobble)
    setRollingCandidateName(candidatePool[0]?.name || 'Bắt đầu lắc xúc xắc...');
    setActiveDiceEmoji('🎲');

    // Recursive candidate cycling scheduler
    let nextCandidateIndex = 0;
    const scheduleNextTick = (targetTimeOffsetMs: number, intervalMs: number, endLimitMs: number) => {
      const t = setTimeout(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= totalDurationMs) return;

        nextCandidateIndex = (nextCandidateIndex + 1) % candidatePool.length;
        const candidate = candidatePool[nextCandidateIndex];
        if (candidate) {
          setRollingCandidateName(candidate.name);
        }
        const emojiIndex = Math.floor(Math.random() * diceEmojiList.length);
        setActiveDiceEmoji(diceEmojiList[emojiIndex]);

        // Phase-based sound ticks
        if (elapsed < 1800) {
          playTickSound(440 + Math.random() * 80, 30);
        }

        if (elapsed + intervalMs < endLimitMs) {
          scheduleNextTick(elapsed + intervalMs, intervalMs, endLimitMs);
        }
      }, Math.max(0, targetTimeOffsetMs - (Date.now() - startTime)));
      timersRef.current.push(t);
    };

    // Phase 2: 0.4s – 1.8s (Fast Spin & Rapid Cycling every 55ms)
    const tPhase2 = setTimeout(() => {
      setRollPhase('FAST_SPIN');
      scheduleNextTick(400, 55, 1800);
    }, 400);
    timersRef.current.push(tPhase2);

    // Phase 3: 1.8s – 2.5s (Gradual Deceleration & Progressive slowdown)
    const tPhase3 = setTimeout(() => {
      setRollPhase('DECELERATING');
      const slowDelays = [1840, 1980, 2150, 2340];
      slowDelays.forEach((delayMs, idx) => {
        const tSlow = setTimeout(() => {
          const randCand = candidatePool[(nextCandidateIndex + idx) % candidatePool.length];
          if (randCand) setRollingCandidateName(randCand.name);
          setActiveDiceEmoji(idx % 2 === 0 ? '🎲' : '✨');
          playTickSound(520 - idx * 30, 45);
        }, delayMs);
        timersRef.current.push(tSlow);
      });
    }, 1800);
    timersRef.current.push(tPhase3);

    // Phase 4: 2.5s – 3.0s (Dice Lands, Final Winner locked in preview, Sparkles)
    const tPhase4 = setTimeout(() => {
      setRollPhase('LANDING');
      setRollingCandidateName(chosenName);
      setActiveDiceEmoji('🎲');
      playLandingChime();
    }, 2500);
    timersRef.current.push(tPhase4);

    // Phase 5: 3.0s Exact (Instant Full Winner Reveal & Immediate Actionable Buttons)
    const tPhase5 = setTimeout(() => {
      setWinnerPlace(chosen);
      setExcludedWinnerIds((prev) => [...prev, chosen.id]);
      setIsRolling(false);
      setRollPhase('IDLE');
      setIsRevealed(true);
      setRollProgressPercent(100);
    }, 3000);
    timersRef.current.push(tPhase5);
  };

  // Re-roll again in next round
  const handleRollAgain = () => {
    setRoundNumber((r) => r + 1);
    setIsRevealed(false);
    handleRollDice();
  };

  // Format distance
  const getPlaceDistanceText = (place: Place) => {
    const meters = getDistance(centerLocation, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
    if (meters < 1000) {
      return `${meters}m · ~${Math.max(2, Math.round(meters / 80))} phút`;
    }
    const km = (meters / 1000).toFixed(1);
    const estMinutes = Math.round((meters / 1000) * 4) + 2;
    return `${km} km · ~${estMinutes} phút đi xe`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-300 animate-fade-in"
      onClick={onClose}
      id="bite-roulette-modal-backdrop"
    >
      <div
        className="bg-[#FDFCF8] text-[#2D2926] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-stone-200/90 shadow-[0_20px_60px_rgba(45,41,38,0.28)] flex flex-col max-h-[90vh] overflow-hidden animate-slide-up relative"
        onClick={(e) => e.stopPropagation()}
        id="bite-roulette-container"
      >
        {/* Subtle Top Handle for Mobile Drag */}
        <div className="w-12 h-1.2 bg-stone-300 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* 1. Header Row */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-stone-200/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-lg font-bold shadow-2xs">
              🎲
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-base text-[#2D2926] leading-tight flex items-center gap-1.5">
                <span>Hôm nay ăn gì?</span>
                <span className="text-[10px] font-heading font-black bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded-full uppercase">
                  BiteQuest Pick
                </span>
              </h2>
              <p className="text-[11.5px] text-stone-500 font-medium leading-tight mt-0.5">
                Để BiteQuest chọn hộ bạn một nơi ngon và đúng gu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            title="Đóng"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 2. Modal Body Container */}
        <div className="overflow-y-auto no-scrollbar px-5 py-4 space-y-4">
          {/* STATE A: SETUP SCREEN (Customize & Prepare) */}
          {!isRevealed && !isRolling && (
            <div className="space-y-4 animate-fade-in">
              {/* Mode Switcher Pill */}
              <div className="flex items-center p-1 bg-stone-100/90 rounded-2xl border border-stone-200/80">
                <button
                  type="button"
                  onClick={() => setPickerMode('AUTO')}
                  className={`flex-1 py-1.5 px-3 rounded-xl font-heading text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    pickerMode === 'AUTO'
                      ? 'bg-white text-[#2D2926] shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <span>✨</span>
                  <span>BiteQuest chọn hộ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode('SHORTLIST')}
                  className={`flex-1 py-1.5 px-3 rounded-xl font-heading text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    pickerMode === 'SHORTLIST'
                      ? 'bg-white text-[#2D2926] shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <span>🎯</span>
                  <span>Quán tôi đã chọn {savedPlaceIds.length > 0 ? `(${savedPlaceIds.length})` : ''}</span>
                </button>
              </div>

              {/* MODE 1: AUTO PICKER CONFIG */}
              {pickerMode === 'AUTO' && (
                <>
                  {/* Step 1: Distance Radius */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-heading font-bold text-stone-700">
                        📍 Hôm nay muốn tìm ở đâu?
                      </span>
                      <span className="text-[11px] text-amber-800 font-semibold">
                        {selectedRadius < 1000
                          ? `${selectedRadius}m · Đi bộ`
                          : `${(selectedRadius / 1000).toFixed(selectedRadius % 1000 === 0 ? 0 : 1)} km ${
                              selectedRadius > 5000 ? '(Tối đa 50 km)' : ''
                            }`}
                      </span>
                    </div>

                    {/* Presets Grid */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {DISTANCE_PRESETS.map((opt) => {
                        const isSelected = !isCustomRadius && selectedRadius === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setIsCustomRadius(false);
                              setSelectedRadius(opt.value);
                            }}
                            className={`py-2 px-1 rounded-xl text-center font-heading text-xs font-bold transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-2xs font-extrabold scale-102'
                                : 'bg-white hover:bg-stone-50 text-stone-600 border-stone-200/80'
                            }`}
                          >
                            <div>{opt.label}</div>
                          </button>
                        );
                      })}

                      {/* Custom Range Button (>5km to 50km) */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomRadius(true);
                          if (selectedRadius <= 5000) {
                            setSelectedRadius(15000); // default to 15km when activating custom
                          }
                        }}
                        className={`py-2 px-1 rounded-xl text-center font-heading text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center ${
                          isCustomRadius || selectedRadius > 5000
                            ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-2xs font-extrabold scale-102'
                            : 'bg-white hover:bg-stone-50 text-stone-600 border-stone-200/80'
                        }`}
                        title="Tự chọn phạm vi đến 50 km"
                      >
                        <span>{selectedRadius > 5000 ? `${Math.round(selectedRadius / 1000)} km` : '>5 km'}</span>
                        <span className="text-[9px] font-normal leading-none opacity-85">Tự chọn</span>
                      </button>
                    </div>

                    {/* Custom Range Slider (5km to 50km) */}
                    {(isCustomRadius || selectedRadius > 5000) && (
                      <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-heading font-bold text-amber-950">
                            Phạm vi: <strong className="text-[#FF6B35] font-black text-sm">{Math.round(selectedRadius / 1000)} km</strong>
                          </span>
                          <span className="text-[10.5px] text-amber-800/80 font-medium">
                            Kéo chọn (5 km – 50 km)
                          </span>
                        </div>

                        <input
                          type="range"
                          min="5"
                          max="50"
                          step="1"
                          value={Math.max(5, Math.min(50, Math.round(selectedRadius / 1000)))}
                          onChange={(e) => {
                            const km = parseInt(e.target.value, 10);
                            setSelectedRadius(km * 1000);
                            setIsCustomRadius(true);
                          }}
                          className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-[#FF6B35]"
                        />

                        {/* Quick Jump Distance Chips */}
                        <div className="flex items-center justify-between gap-1 pt-1">
                          {[10, 15, 20, 30, 50].map((km) => (
                            <button
                              key={km}
                              type="button"
                              onClick={() => {
                                setSelectedRadius(km * 1000);
                                setIsCustomRadius(true);
                              }}
                              className={`px-2 py-1 rounded-lg text-[10.5px] font-heading font-bold transition-all cursor-pointer border ${
                                selectedRadius === km * 1000
                                  ? 'bg-[#FF6B35] text-white border-[#FF6B35] shadow-2xs'
                                  : 'bg-white hover:bg-amber-100/60 text-stone-700 border-amber-200/60'
                              }`}
                            >
                              {km === 50 ? '50 km (Max)' : `${km} km`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2: What to eat today? */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-heading font-bold text-stone-700">
                        🍽️ Hôm nay muốn gì?
                      </span>
                      <span className="text-[11px] text-amber-700 font-medium">
                        {selectedCategories.includes('ALL') ? 'Tất cả món' : `Đã chọn (${selectedCategories.length})`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORY_OPTIONS.map((cat) => {
                        const isSelected = selectedCategories.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleToggleCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-xl font-heading text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                              isSelected
                                ? 'bg-[#FF6B35] text-white border-[#FF6B35] shadow-2xs scale-102'
                                : 'bg-white hover:bg-stone-50 text-stone-600 border-stone-200/80'
                            }`}
                          >
                            <span>{cat.icon}</span>
                            <span>{cat.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* MODE 2: SHORTLIST CONFIG */}
              {pickerMode === 'SHORTLIST' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-heading font-bold text-stone-700">
                      🎯 Chọn các quán bạn đang phân vân:
                    </span>
                    <span className="text-[11px] text-stone-500 font-medium">
                      Đã chọn {selectedShortlistIds.length} quán
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5 no-scrollbar divide-y divide-stone-100 border border-stone-200/70 rounded-2xl p-2 bg-white">
                    {places.slice(0, 15).map((place) => {
                      const isChecked = selectedShortlistIds.includes(place.id);
                      return (
                        <div
                          key={place.id}
                          onClick={() => handleToggleShortlist(place.id)}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-4 h-4 text-[#FF6B35] rounded accent-[#FF6B35] cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="font-heading text-xs font-bold text-stone-800 truncate">
                                {place.name}
                              </p>
                              <p className="text-[10.5px] text-stone-400 truncate">
                                {place.categoryLabel || place.category} · {place.district}
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] text-amber-600 font-heading font-bold shrink-0">
                            {place.rating > 0 ? `${place.rating} ★` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Candidate Pool Indicator (Anticipation & Grounding) */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🎯</span>
                  <span className="text-xs font-heading font-bold text-amber-900">
                    {candidatePool.length > 0 ? (
                      <>Có <strong>{candidatePool.length} nơi phù hợp</strong> quanh đây</>
                    ) : (
                      <>Không có quán khớp, hãy thử mở rộng bán kính</>
                    )}
                  </span>
                </div>

                <span className="text-[11px] text-amber-800/80 font-medium">
                  {pickerMode === 'AUTO' ? 'Tự động lọc' : 'Lựa chọn của bạn'}
                </span>
              </div>

              {/* Primary Roll Action Button */}
              <button
                type="button"
                onClick={handleRollDice}
                disabled={candidatePool.length === 0}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-[#FF6B35] hover:opacity-95 active:scale-[0.98] text-white font-heading font-extrabold text-sm rounded-2xl shadow-[0_6px_20px_rgba(245,158,11,0.35)] transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                id="btn-roll-dice-main"
              >
                <span className="text-lg">🎲</span>
                <span>QUAY XÚC XẮC (ĐỂ BITEQUEST CHỌN)</span>
              </button>
            </div>
          )}

          {/* STATE B: ROLLING ANIMATION (Tactile 3.0s Anticipation & Reveal Choreography) */}
          {isRolling && (
            <div className="py-7 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
              {/* Dynamic Animated Dice Orb */}
              <div className="relative flex items-center justify-center">
                {/* Ambient Kinetic Energy Aura */}
                <div
                  className={`absolute w-28 h-28 rounded-full blur-xl transition-all duration-300 pointer-events-none ${
                    rollPhase === 'FAST_SPIN'
                      ? 'bg-orange-500/35 scale-125'
                      : rollPhase === 'DECELERATING'
                      ? 'bg-amber-400/25 scale-110'
                      : rollPhase === 'LANDING'
                      ? 'bg-emerald-400/30 scale-140'
                      : 'bg-amber-400/15 scale-100'
                  }`}
                />

                {/* Main Dice Capsule */}
                <div
                  className={`w-22 h-22 rounded-3xl bg-gradient-to-tr from-amber-400 via-orange-500 to-[#FF6B35] flex items-center justify-center text-4xl shadow-[0_8px_30px_rgba(245,158,11,0.45)] border-2 border-white/80 transition-transform ${
                    rollPhase === 'STARTING'
                      ? 'animate-pulse scale-95 rotate-3'
                      : rollPhase === 'FAST_SPIN'
                      ? 'animate-spin scale-110'
                      : rollPhase === 'DECELERATING'
                      ? 'scale-105 transition-all duration-500'
                      : rollPhase === 'LANDING'
                      ? 'scale-115 transition-transform duration-200 ring-4 ring-amber-400/60 ring-offset-2'
                      : ''
                  }`}
                >
                  <span className="drop-shadow-sm select-none">{activeDiceEmoji}</span>
                </div>

                {/* Surrounding Sparkles & Micro Orbs */}
                <div className="absolute -top-2 -right-2 text-base animate-bounce">
                  ✨
                </div>
                <div className="absolute -bottom-2 -left-2 text-sm animate-pulse text-amber-500">
                  ✦
                </div>
                {rollPhase === 'LANDING' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-heading font-black bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full shadow-md animate-bounce">
                    CHỐT!
                  </div>
                )}
              </div>

              {/* Status Header & Dynamic Candidate Cycling */}
              <div className="w-full max-w-xs space-y-1.5 px-2">
                <h3 className="font-heading font-extrabold text-sm text-[#2D2926] flex items-center justify-center gap-1.5">
                  {rollPhase === 'STARTING' && (
                    <>
                      <span>🎲</span>
                      <span>Bắt đầu lắc xúc xắc...</span>
                    </>
                  )}
                  {rollPhase === 'FAST_SPIN' && (
                    <>
                      <span>🔥</span>
                      <span>Đang chọn quán ngon quanh bạn...</span>
                    </>
                  )}
                  {rollPhase === 'DECELERATING' && (
                    <>
                      <span>✨</span>
                      <span>Sắp chốt được quán chân ái...</span>
                    </>
                  )}
                  {rollPhase === 'LANDING' && (
                    <>
                      <span>🎯</span>
                      <span className="text-emerald-700">Đã tìm thấy quán phù hợp!</span>
                    </>
                  )}
                </h3>

                {/* Candidate Name Flash Pill */}
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl py-1.5 px-3 min-h-[32px] flex items-center justify-center">
                  <p className="text-xs text-amber-900 font-heading font-bold truncate max-w-[260px]">
                    {rollingCandidateName || 'Đang quét dữ liệu quán ngon...'}
                  </p>
                </div>

                {/* 3-Second Anticipation Progress Indicator */}
                <div className="pt-2 w-full">
                  <div className="w-full h-1.5 bg-stone-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-[#FF6B35] transition-all ease-linear"
                      style={{ width: `${rollProgressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-stone-400 font-medium mt-1">
                    <span>Lắc xúc xắc</span>
                    <span>3 giây</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STATE C: WINNER REVEAL (Wow Moment & Clear Decision) */}
          {isRevealed && winnerPlace && (
            <div className="space-y-4 animate-slide-up">
              {/* Reveal Crown Tag */}
              <div className="flex items-center justify-between pb-1 border-b border-stone-100">
                <div className="flex items-center gap-1.5 text-xs font-heading font-black text-amber-600 uppercase tracking-wide">
                  <span>✦</span>
                  <span>BITEQUEST ĐÃ CHỌN CHO BẠN</span>
                </div>
                <span className="bg-amber-100 text-amber-900 text-[10.5px] font-heading font-extrabold px-2 py-0.5 rounded-full">
                  Lượt {roundNumber}
                </span>
              </div>

              {/* Hero Winner Card */}
              <div className="bg-white p-4 rounded-2xl border-2 border-amber-400/80 shadow-[0_8px_24px_rgba(245,158,11,0.18)] space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-lg font-black text-[#2D2926] leading-tight truncate">
                      {winnerPlace.name}
                    </h3>
                    <p className="text-xs text-stone-500 font-medium truncate mt-0.5">
                      {winnerPlace.address || winnerPlace.district}
                    </p>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-stone-950 font-heading font-extrabold text-xs shadow-2xs">
                      {winnerPlace.rating > 0 ? `${winnerPlace.rating} ★` : '4.8 ★'}
                    </span>
                    <span className="text-[10px] text-stone-400 mt-0.5">
                      {winnerPlace.categoryLabel || winnerPlace.category}
                    </span>
                  </div>
                </div>

                {/* Human Reason & Context */}
                <div className="p-2.5 rounded-xl bg-[#FDFCF8] border border-stone-200/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-stone-700 font-medium truncate">
                    <span className="text-amber-500">📍</span>
                    <span>{getPlaceDistanceText(winnerPlace)}</span>
                  </div>
                  <span className="text-emerald-700 font-heading font-bold text-[11px] shrink-0">
                    Đang mở cửa
                  </span>
                </div>

                <p className="text-xs text-[#594139] leading-relaxed italic bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60">
                  {pickerMode === 'SHORTLIST'
                    ? '🎯 Lựa chọn chiến thắng từ danh sách các quán bạn đang phân vân!'
                    : `✨ Được chọn trong số ${candidatePool.length + 1} quán ngon gần bạn. Quán này đang rất hợp thời điểm hiện tại.`}
                </p>
              </div>

              {/* Gentle decision helper after multiple rolls */}
              {roundNumber >= 3 && (
                <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-[11.5px] text-teal-900 flex items-center gap-2">
                  <span>💡</span>
                  <span>Bạn đã xem {roundNumber} lựa chọn. Chỗ này đang là điểm đến thuận tiện nhất!</span>
                </div>
              )}

              {/* Action Buttons: Go Now vs Roll Again */}
              <div className="space-y-2 pt-1">
                {/* 1. Go To Venue Primary Button */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectPlace(winnerPlace);
                  }}
                  className="w-full py-3.5 px-4 bg-[#FF6B35] hover:bg-[#E85D2A] active:scale-[0.98] text-white font-heading font-extrabold text-sm rounded-2xl shadow-[0_6px_20px_rgba(255,107,53,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2"
                  id="btn-confirm-winner-place"
                >
                  <span>🚀</span>
                  <span>ĐI THÔI (XEM TRÊN BẢN ĐỒ)</span>
                </button>

                {/* 2. Roll Again Secondary Button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRollAgain}
                    className="flex-1 py-2.5 px-3 bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-800 font-heading text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    id="btn-roll-again"
                  >
                    <span>🎲</span>
                    <span>Xúc lại (Lượt {roundNumber + 1})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsRevealed(false);
                      setWinnerPlace(null);
                    }}
                    className="py-2.5 px-3 hover:bg-stone-100 text-stone-500 hover:text-stone-800 font-heading text-xs font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    Đổi phạm vi / món
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
