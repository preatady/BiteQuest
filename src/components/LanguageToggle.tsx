import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface LanguageToggleProps {
  variant?: 'pill' | 'compact' | 'full';
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  variant = 'pill',
  className = '',
}) => {
  const { language, setLanguage, toggleLanguage, isVi } = useLanguage();

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        className={`relative flex items-center justify-center h-8 px-2 rounded-full bg-stone-100 hover:bg-stone-200/80 border border-stone-200/80 text-xs font-bold font-heading text-stone-800 active:scale-95 transition-all cursor-pointer select-none shadow-2xs ${className}`}
        title={isVi ? 'Chuyển sang Tiếng Anh (English)' : 'Switch to Vietnamese (Tiếng Việt)'}
        id="btn-language-toggle-compact"
      >
        <span className="flex items-center gap-1 font-mono text-[11px] font-black">
          <span className={isVi ? 'text-[#FF6B35]' : 'text-stone-400'}>VI</span>
          <span className="text-stone-300">/</span>
          <span className={!isVi ? 'text-[#FF6B35]' : 'text-stone-400'}>EN</span>
        </span>
      </button>
    );
  }

  if (variant === 'full') {
    return (
      <div
        className={`flex items-center p-1 bg-stone-100/90 rounded-2xl border border-stone-200/80 shadow-2xs ${className}`}
        id="language-selector-full"
      >
        <button
          type="button"
          onClick={() => setLanguage('vi')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-heading text-xs font-bold transition-all cursor-pointer ${
            language === 'vi'
              ? 'bg-white text-[#FF6B35] shadow-xs border border-stone-200/60'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <span className="text-sm">🇻🇳</span>
          <span>Tiếng Việt</span>
        </button>

        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-heading text-xs font-bold transition-all cursor-pointer ${
            language === 'en'
              ? 'bg-white text-[#FF6B35] shadow-xs border border-stone-200/60'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <span className="text-sm">🇬🇧</span>
          <span>English</span>
        </button>
      </div>
    );
  }

  // Default: Sleek pill switcher
  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 hover:bg-stone-50 backdrop-blur-md border border-stone-200/90 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer select-none text-[#2D2926] ${className}`}
      title={isVi ? 'Chuyển sang Tiếng Anh (English)' : 'Switch to Vietnamese (Tiếng Việt)'}
      id="btn-language-toggle-pill"
      aria-label="Chuyển đổi ngôn ngữ Tiếng Việt / English"
    >
      <span className="text-xs transition-transform duration-200 group-hover:scale-110">
        {isVi ? '🇻🇳' : '🇬🇧'}
      </span>
      <span className="font-heading text-[11px] font-extrabold tracking-tight">
        {isVi ? 'VI' : 'EN'}
      </span>
    </button>
  );
};
