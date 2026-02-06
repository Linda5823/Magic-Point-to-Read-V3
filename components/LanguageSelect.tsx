import React, { useState, useRef, useEffect } from 'react';
import { LanguageCode, COMMON_LANGUAGES, EXTRA_LANGUAGES } from '../types';

interface LanguageSelectProps {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
  className?: string;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({ value, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMoreExpanded, setIsMoreExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = [...COMMON_LANGUAGES, ...EXTRA_LANGUAGES].find(l => l.code === value)?.name ?? '—/No Translation/不翻译';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: LanguageCode) => {
    onChange(code);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 w-full min-w-[200px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl border-0 outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
      >
        <span className="truncate">{displayName}</span>
        <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 py-1 bg-white rounded-xl shadow-lg border border-slate-200 min-w-[220px] max-h-[60vh] overflow-y-auto z-[100]">
          {/* Common languages */}
          {COMMON_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {lang.name}
            </button>
          ))}

          {/* More toggle */}
          <button
            type="button"
            onClick={() => setIsMoreExpanded(!isMoreExpanded)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 border-t border-slate-100 mt-1"
          >
            <span>更多 / More</span>
            <svg className={`w-4 h-4 transition-transform ${isMoreExpanded ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Extra languages - collapsible */}
          {isMoreExpanded && (
            <>
              {EXTRA_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full text-left px-4 py-2.5 pl-6 text-sm transition-colors ${
                    value === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LanguageSelect;
