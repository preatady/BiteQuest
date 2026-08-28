import React, { useEffect } from 'react';

interface ToastData {
  title: string;
  subtitle: string;
  emoji: string;
  xpEarned?: number;
}

interface AchievementToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed top-20 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[400px] z-50 animate-bounce pointer-events-auto">
      <div className="bg-[#2D2926] text-white rounded-2xl p-4 shadow-2xl border border-white/10 flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35] flex items-center justify-center text-2xl flex-shrink-0">
          {toast.emoji}
        </div>

        <div className="flex-grow">
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-xs font-bold text-[#FF6B35]">
              {toast.title}
            </h4>
            {toast.xpEarned && (
              <span className="bg-[#2EC4B6]/20 text-[#2EC4B6] text-[10px] font-heading font-black px-2 py-0.5 rounded-full">
                +{toast.xpEarned} XP
              </span>
            )}
          </div>
          <p className="text-xs text-white/90 font-medium mt-0.5">
            {toast.subtitle}
          </p>
        </div>

        <button
          onClick={onClose}
          className="text-white/50 hover:text-white p-1 text-sm font-bold"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
