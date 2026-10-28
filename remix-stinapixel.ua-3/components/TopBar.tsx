
import React, { useState, useEffect } from 'react';
import { User, Message } from '../types';
import { sound } from '../utils/audio';

import { realtimeClient } from '../utils/realtime';
import SqlBetaModal from './SqlBetaModal';

interface Props {
  user: User;
  onNavigate: (page: 'landing' | 'wall' | 'admin' | 'museum' | 'profile') => void;
  onShowCase: () => void;
  onLogout: () => void;
}

const TopBar: React.FC<Props> = ({ user, onNavigate, onShowCase, onLogout }) => {
  const isGuest = user.id === 'GUEST';
  const [isMuted, setIsMuted] = useState(sound.getMuted());
  const [hasUnread, setHasUnread] = useState(false);
  const [onlineCount, setOnlineCount] = useState(realtimeClient.onlineCount);
  const [showSqlModal, setShowSqlModal] = useState(false);

  useEffect(() => {
    const unsub = realtimeClient.subscribe((event) => {
      if (event.type === 'presence:update' || event.type === 'welcome') {
        setOnlineCount(realtimeClient.onlineCount);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isGuest) return;
    const checkUnread = () => {
      const allMessages: Message[] = JSON.parse(localStorage.getItem('stnapixel_messages') || '[]');
      const unread = allMessages.some(m => m.toId === user.id && !m.isRead);
      setHasUnread(unread);
    };
    checkUnread();
    const interval = setInterval(checkUnread, 3000);
    return () => clearInterval(interval);
  }, [user.id, isGuest]);

  const toggleSound = () => {
    const newState = !isMuted;
    sound.setMuted(newState);
    setIsMuted(newState);
  };

  return (
    <>
      <header className="bg-black/95 backdrop-blur-md h-14 md:h-18 landscape:h-11 md:landscape:h-16 flex items-center justify-between px-3 sm:px-4 md:px-8 z-30 shadow-xl border-b border-slate-800/80 relative flex-shrink-0 select-none">
        <div className="flex items-center min-w-0 space-x-2 sm:space-x-3">
          <h1 
            className="text-lg sm:text-xl md:text-2xl font-bold text-blue-500 cursor-pointer tracking-tight truncate hover:opacity-85 transition-opacity"
            onClick={() => onNavigate('wall')}
          >
            <span className="hidden xs:inline">StinaPixel</span><span className="xs:hidden">SP</span><span className="text-white">.ua</span>
          </h1>

          {/* Beta 100 Players Live Indicator & SQL Modal Trigger */}
          <button
            onClick={() => setShowSqlModal(true)}
            className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-[10px] sm:text-xs text-emerald-400 font-mono transition-all shadow-[0_0_10px_rgba(16,185,129,0.15)] group"
            title="Бета на 100 гравців: переглянути SQL схему та статус полотна"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-semibold hidden sm:inline">Бета 100:</span>
            <span>{onlineCount}/100</span>
            <span className="text-[10px] bg-emerald-800/50 text-emerald-200 px-1 rounded uppercase font-sans font-bold group-hover:bg-emerald-700/60 transition-colors">SQL</span>
          </button>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3.5 landscape:space-x-1.5 md:landscape:space-x-3.5 flex-shrink-0">
        {isGuest && (
          <button 
            onClick={onLogout}
            className="bg-blue-600/10 hover:bg-blue-600/20 active:bg-blue-600/30 text-blue-400 font-bold px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[10px] uppercase tracking-wider border border-blue-500/30 transition-all flex items-center space-x-1.5"
            title="Повернутися до входу"
          >
            <span>🚪</span>
            <span className="hidden sm:inline">Вхід</span>
          </button>
        )}

        <button 
          onClick={toggleSound}
          className={`w-8 h-8 sm:w-9 sm:h-9 landscape:w-7 landscape:h-7 md:landscape:w-9 md:landscape:h-9 rounded-xl flex items-center justify-center transition-all border ${isMuted ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-blue-600/15 border-blue-500/40 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)]'}`}
          title={isMuted ? "Увімкнути звук" : "Вимкнути звук"}
          aria-label="Звук"
        >
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 landscape:h-3.5 landscape:w-3.5 md:landscape:h-5 md:landscape:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 landscape:h-3.5 landscape:w-3.5 md:landscape:h-5 md:landscape:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
          )}
        </button>

        <button 
          onClick={() => onNavigate('museum')}
          className="bg-slate-900/80 hover:bg-slate-800 active:bg-slate-700 text-slate-300 hover:text-white transition-all px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-slate-800 flex items-center space-x-1.5 landscape:py-1 landscape:px-2 md:landscape:py-1.5 md:landscape:px-3.5"
          title="Музей Артів"
        >
          <span className="text-xs">🏛️</span>
          <span className="hidden sm:inline landscape:hidden md:landscape:inline">Музей</span>
        </button>

        {!isGuest && (
          <div 
            onClick={() => onNavigate('profile')}
            className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 sm:px-3.5 py-1 sm:py-1.5 flex items-center cursor-pointer hover:bg-slate-850 hover:border-slate-700 transition-all shadow-sm group landscape:py-1 landscape:px-2.5"
            title="Баланс / Гаманець"
          >
            <span className="text-blue-400 font-bold mr-1 text-xs sm:text-sm">₴</span>
            <span className="text-white font-mono font-bold text-xs sm:text-sm">{user.balance.toFixed(1)}</span>
            <div className="ml-1.5 sm:ml-2.5 w-4 h-4 sm:w-5 sm:h-5 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold group-hover:bg-blue-500 transition-colors">+</div>
          </div>
        )}

        {!isGuest && (
          <button 
            onClick={onShowCase}
            className="bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 active:scale-95 text-white text-[10px] font-bold py-1.5 px-2.5 sm:px-3.5 rounded-xl uppercase tracking-wider shadow-sm transition-all flex items-center space-x-1 landscape:py-1 landscape:px-2 md:landscape:py-1.5 md:landscape:px-3"
            title="Щоденний бонус"
          >
            <span>🎁</span>
            <span className="hidden md:inline landscape:hidden md:landscape:inline">Бонус</span>
          </button>
        )}

        <div 
          className={`flex items-center p-0.5 rounded-xl transition-all relative ${isGuest ? 'cursor-default' : 'cursor-pointer hover:bg-slate-900'}`}
          onClick={() => !isGuest && onNavigate('profile')}
          title="Профіль"
        >
          <div className={`w-8 h-8 sm:w-9 sm:h-9 landscape:w-7 landscape:h-7 md:landscape:w-9 md:landscape:h-9 ${isGuest ? 'bg-slate-800 border border-slate-700' : 'bg-blue-600'} rounded-xl flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-sm`}>
            {user.username[0]?.toUpperCase() || 'U'}
          </div>
          {hasUnread && (
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-600 rounded-full border-2 border-black animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.7)]"></div>
          )}
        </div>

        {user.isAdmin && (
          <button 
            onClick={() => onNavigate('admin')}
            className="w-8 h-8 sm:w-9 sm:h-9 landscape:w-7 landscape:h-7 md:landscape:w-9 md:landscape:h-9 bg-purple-600 hover:bg-purple-500 rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95"
            title="Адмін Панель"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-4.5 sm:w-4.5 landscape:h-3.5 landscape:w-3.5 md:landscape:h-4.5 md:landscape:w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
        )}
      </div>
    </header>
    <SqlBetaModal 
      isOpen={showSqlModal} 
      onClose={() => setShowSqlModal(false)} 
      isAdmin={user.isAdmin} 
    />
  </>
  );
};

export default TopBar;
