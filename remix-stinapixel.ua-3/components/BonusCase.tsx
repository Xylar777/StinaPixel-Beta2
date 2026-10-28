
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { REWARDS } from '../constants';
import { sound } from '../utils/audio';

interface Props {
  user: { id: string };
  onClose: () => void;
  onWin: (amount: number) => void;
}

const BonusCase: React.FC<Props> = ({ user, onClose, onWin }) => {
  const [spinning, setSpinning] = useState(false);
  const [wonAmount, setWonAmount] = useState<number | null>(null);
  const [cooldownTime, setCooldownTime] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSpinningRef = useRef(false);
  const isMounted = useRef(true);

  const STORAGE_KEY = `stnapixel_case_cooldown_${user.id}`;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      isSpinningRef.current = false;
    };
  }, []);

  const track = useMemo(() => {
    return Array.from({ length: 160 }).map(() => {
      const r = Math.random();
      let cumulative = 0;
      for (const reward of REWARDS) {
        cumulative += reward.chance;
        if (r <= cumulative) return reward;
      }
      return REWARDS[REWARDS.length - 1]; 
    });
  }, []);

  useEffect(() => {
    const checkCooldown = () => {
      const lastOpen = localStorage.getItem(STORAGE_KEY);
      if (lastOpen) {
        const diff = Date.now() - parseInt(lastOpen);
        const remaining = 24 * 60 * 60 * 1000 - diff;
        if (remaining > 0) setCooldownTime(remaining);
        else setCooldownTime(null);
      }
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [user.id]);

  const handleSpin = () => {
    if (spinning || cooldownTime !== null || !containerRef.current || !trackRef.current) return;
    setSpinning(true);
    isSpinningRef.current = true;
    
    const winIndex = Math.floor(Math.random() * 20) + 125;
    const winner = track[winIndex]; 
    
    const itemWidthRem = 7; 
    const gapRem = 0.5; 
    const stepRem = itemWidthRem + gapRem; 
    
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const containerWidth = containerRef.current.offsetWidth;
    const viewportCenterRem = (containerWidth / 2) / rootFontSize;
    
    const innerCardOffsetRem = (Math.random() * 5) + 1; 
    const itemLeftPosRem = winIndex * stepRem;
    const targetTranslateRem = viewportCenterRem - itemLeftPosRem - innerCardOffsetRem;

    const spinDuration = 8000;
    
    trackRef.current.style.transition = 'none';
    trackRef.current.style.transform = 'translateX(0rem)';
    void trackRef.current.offsetWidth; 

    trackRef.current.style.transition = `transform ${spinDuration}ms cubic-bezier(0.12, 0, 0.05, 1)`;
    trackRef.current.style.transform = `translateX(${targetTranslateRem}rem)`;

    let currentItem = 0;
    const totalItemsToPass = winIndex;
    
    const playTickLoop = () => {
      if (!isMounted.current || !isSpinningRef.current || currentItem >= totalItemsToPass) return;
      
      const progress = currentItem / totalItemsToPass;
      const delay = 40 + Math.pow(progress, 3.8) * 900;
      
      sound.playTick(1 - progress * 0.7);
      currentItem++;
      
      if (currentItem < totalItemsToPass && isSpinningRef.current) {
        setTimeout(playTickLoop, delay);
      }
    };

    playTickLoop();

    setTimeout(() => {
      if (!isMounted.current) return;
      isSpinningRef.current = false;
      setWonAmount(winner.value);
      onWin(winner.value);
      sound.playWin();
      setSpinning(false);
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }, spinDuration + 300);
  };

  const formatTime = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}г ${m}хв ${s}с`;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl p-5 sm:p-8 md:p-12 rounded-2xl sm:rounded-3xl shadow-2xl relative overflow-hidden my-auto max-h-[96vh] overflow-y-auto custom-scrollbar">
        <button 
          onClick={() => {
            isSpinningRef.current = false;
            onClose();
          }} 
          disabled={spinning} 
          className="absolute top-3 right-3 sm:top-6 sm:right-6 text-slate-500 hover:text-white z-50 disabled:opacity-0 transition-all p-1.5 rounded-xl hover:bg-slate-800"
          aria-label="Закрити"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="text-center mb-4 sm:mb-8 md:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2 tracking-tight">Щоденний Бонус</h2>
          <p className="text-slate-400 font-medium uppercase tracking-wider text-[10px] sm:text-xs">Безкоштовний виграш кожні 24 години</p>
        </div>

        <div ref={containerRef} className="relative mb-6 sm:mb-10 md:mb-12 h-36 sm:h-44 md:h-48 bg-black/60 rounded-2xl sm:rounded-3xl border border-slate-800 overflow-hidden flex items-center shadow-inner">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-amber-400 z-20 shadow-[0_0_20px_rgba(251,191,36,0.8)]"></div>
          
          <div ref={trackRef} className="flex items-center space-x-2 px-0" style={{ transform: 'translateX(0rem)', willChange: 'transform' }}>
            {track.map((item, i) => (
              <div key={i} className={`w-28 h-28 flex-shrink-0 rounded-2xl ${item.color} flex flex-col items-center justify-center border-2 border-white/20 shadow-xl`}>
                <span className="text-white font-bold text-2xl tracking-tight">{item.value.toFixed(0)}</span>
                <span className="text-white/60 font-semibold text-[10px] uppercase font-mono">UAH</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center">
          {wonAmount !== null ? (
            <div className="text-center animate-in zoom-in duration-500">
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] sm:text-xs mb-2">Виграш отримано!</p>
              <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-6 sm:mb-8">
                <h3 className="text-5xl sm:text-7xl md:text-8xl font-bold text-amber-400 tracking-tight drop-shadow">{wonAmount.toFixed(0)}</h3>
                <span className="text-3xl sm:text-5xl md:text-6xl font-bold text-amber-400">₴</span>
              </div>
              <button 
                onClick={onClose} 
                className="bg-white text-slate-900 px-8 sm:px-14 py-3 sm:py-4 rounded-xl font-bold uppercase text-xs sm:text-sm tracking-wider transition-all hover:bg-slate-200 shadow-xl active:scale-95"
              >
                Забрати виграш
              </button>
            </div>
          ) : cooldownTime ? (
            <div className="text-center">
              <p className="text-slate-500 font-medium text-xs uppercase mb-3 sm:mb-4 tracking-wider">Наступна спроба через:</p>
              <div className="text-2xl sm:text-3xl md:text-4xl font-mono text-white font-bold px-6 sm:px-10 py-3 sm:py-5 bg-slate-800/80 rounded-2xl border border-slate-700 shadow-lg">
                {formatTime(cooldownTime)}
              </div>
            </div>
          ) : (
            <button 
              onClick={handleSpin} 
              disabled={spinning} 
              className="bg-blue-600 hover:bg-blue-500 text-white text-base sm:text-lg font-bold px-8 sm:px-16 py-3.5 sm:py-4.5 rounded-xl shadow-xl transition-all uppercase tracking-wider active:scale-95 disabled:opacity-50"
            >
              Отримати Бонус
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BonusCase;
