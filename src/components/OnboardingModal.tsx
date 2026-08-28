import React, { useState } from 'react';
import {
  ONBOARDING_FOOD_PREFERENCES,
  FoodPreferenceOption,
  ONBOARDING_EXPLORATION_STYLES,
  ExplorationStyleOption,
  User,
} from '../types';
import { saveUserOnboardingPreferences } from '../services/firebaseDb';

interface OnboardingModalProps {
  isOpen: boolean;
  user: User;
  onComplete: (updatedUser: User) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  user,
  onComplete,
}) => {
  const [selectedFoods, setSelectedFoods] = useState<string[]>(
    user.foodPreferences && user.foodPreferences.length > 0 ? user.foodPreferences : []
  );
  const [selectedStyle, setSelectedStyle] = useState<string>(
    user.explorationStyle || ONBOARDING_EXPLORATION_STYLES[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Toggle food selection up to max 3
  const toggleFood = (item: FoodPreferenceOption) => {
    if (selectedFoods.includes(item)) {
      setSelectedFoods(selectedFoods.filter((f) => f !== item));
    } else {
      if (selectedFoods.length >= 3) {
        // Cap at 3 - replace the earliest or ignore
        return;
      }
      setSelectedFoods([...selectedFoods, item]);
    }
  };

  const handleFinish = async (isSkip = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const foodsToSave = isSkip ? [] : selectedFoods;
    const styleToSave = isSkip ? undefined : selectedStyle;

    try {
      if (user.id) {
        await saveUserOnboardingPreferences(user.id, foodsToSave, styleToSave);
      }

      // Also notify server endpoint if token is available
      try {
        await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            foodPreferences: foodsToSave,
            explorationStyle: styleToSave,
            onboardingCompleted: true,
          }),
        });
      } catch (e) {
        // Non-blocking
      }

      const updatedUser: User = {
        ...user,
        foodPreferences: foodsToSave,
        explorationStyle: styleToSave,
        onboardingCompleted: true,
      };

      onComplete(updatedUser);
    } catch (err) {
      console.warn('Could not save onboarding preferences:', err);
      onComplete({
        ...user,
        foodPreferences: foodsToSave,
        explorationStyle: styleToSave,
        onboardingCompleted: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="onboarding-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div
        id="onboarding-modal-container"
        className="w-full max-w-md bg-[#FFFDF9] rounded-3xl p-5 sm:p-7 shadow-2xl border border-[#FF6B35]/20 max-h-[calc(100dvh-2rem)] overflow-y-auto flex flex-col justify-between"
      >
        <div>
          {/* Header */}
          <div className="text-center mb-6">
            <span className="inline-block px-3 py-1 bg-[#FF6B35]/10 text-[#FF6B35] font-heading font-black text-xs rounded-full uppercase tracking-wider mb-2">
              ✨ Cá nhân hoá trải nghiệm
            </span>
            <h2 className="text-xl sm:text-2xl font-heading font-black text-[#1A1D1E] tracking-tight">
              Chào mừng {user.displayName || user.name || 'Bite Explorer'}!
            </h2>
            <p className="text-xs text-neutral-500 font-sans mt-1">
              Chỉ 20 giây giúp BiteQuest đề xuất chuẩn gu của bạn tại Hà Nội.
            </p>
          </div>

          {/* Question 1: Favorite Food Categories (Max 3) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-sm font-heading font-bold text-[#1A1D1E] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#FF6B35]">
                  restaurant
                </span>
                <span>1. Bạn thích ăn gì?</span>
              </label>
              <span
                className={`text-xs font-heading font-bold px-2 py-0.5 rounded-full ${
                  selectedFoods.length === 3
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-[#F5F3ED] text-neutral-600'
                }`}
              >
                {selectedFoods.length}/3 món
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ONBOARDING_FOOD_PREFERENCES.map((food) => {
                const isSelected = selectedFoods.includes(food);
                const isMaxReached = selectedFoods.length >= 3 && !isSelected;

                return (
                  <button
                    key={food}
                    type="button"
                    onClick={() => toggleFood(food)}
                    disabled={isMaxReached}
                    className={`py-2.5 px-2 rounded-2xl text-xs font-heading font-bold border transition-all text-center flex items-center justify-center whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#FF6B35] text-white border-[#FF6B35] shadow-xs scale-102'
                        : isMaxReached
                        ? 'bg-[#F5F3ED]/60 text-neutral-400 border-transparent opacity-60 cursor-not-allowed'
                        : 'bg-[#F5F3ED] text-[#1A1D1E] border-transparent hover:border-[#FF6B35]/30'
                    }`}
                  >
                    {food}
                  </button>
                );
              })}
            </div>
            {selectedFoods.length >= 3 && (
              <p className="text-[11px] text-amber-700 font-sans mt-1.5 text-right">
                Đã chọn tối đa 3 món. Bỏ chọn một món nếu bạn muốn đổi.
              </p>
            )}
          </div>

          {/* Question 2: Exploration Style (1 Selection) */}
          <div className="mb-6">
            <label className="block text-sm font-heading font-bold text-[#1A1D1E] mb-2.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#FF6B35]">explore</span>
              <span>2. Phong cách khám phá của bạn?</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ONBOARDING_EXPLORATION_STYLES.map((style) => {
                const isSelected = selectedStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setSelectedStyle(style)}
                    className={`py-3 px-3.5 rounded-2xl text-xs font-heading font-bold border transition-all text-left flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#FF6B35]/10 border-[#FF6B35] text-[#FF6B35] shadow-xs'
                        : 'bg-[#F5F3ED] border-transparent text-[#1A1D1E] hover:border-neutral-300'
                    }`}
                  >
                    <span>{style}</span>
                    {isSelected && (
                      <span className="material-symbols-outlined text-[16px] text-[#FF6B35]">
                        check_circle
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-neutral-100 flex flex-col gap-2">
          <button
            type="button"
            id="onboarding-complete-btn"
            onClick={() => handleFinish(false)}
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-2xl font-heading text-sm font-bold shadow-md hover:shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="material-symbols-outlined text-[18px] animate-spin">
                progress_activity
              </span>
            ) : (
              <>
                <span>Bắt đầu khám phá</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="onboarding-skip-btn"
            onClick={() => handleFinish(true)}
            disabled={isSubmitting}
            className="w-full py-2 text-xs text-neutral-500 hover:text-neutral-800 font-sans font-medium text-center transition-colors"
          >
            Bỏ qua bước này
          </button>
        </div>
      </div>
    </div>
  );
};
