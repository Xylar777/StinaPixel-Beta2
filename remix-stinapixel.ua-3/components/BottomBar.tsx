
import React from 'react';

interface Props {
  coords: { x: number, y: number };
  isAdmin: boolean;
  onlineCount: number;
  draftCount: number;
  draftCost: number;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const BottomBar: React.FC<Props> = ({ coords, isAdmin, onlineCount, draftCount, draftCost, onUndo, onRedo, canUndo, canRedo }) => {
  return (
    <footer className="bg-slate-950/95 backdrop-blur-md h-8 sm:h-9 md:h-10 landscape:h-6.5 md:landscape:h-10 border-t border-slate-800/80 flex items-center justify-between px-2.5 sm:px-4 md:px-6 z-30 select-none flex-shrink-0">
      <div className="flex items-center space-x-2 sm:space-x-4 text-[11px] sm:text-xs font-mono">
        <div className="flex items-center space-x-1.5 text-slate-400">
          <span className="text-slate-500 uppercase font-medium hidden xs:inline">XY</span>
          <span className="text-blue-400 font-semibold">{coords.x},{coords.y}</span>
        </div>
        <div className="h-3.5 w-px bg-slate-800 hidden sm:block"></div>
        <div className="flex items-center space-x-0.5 sm:space-x-1">
          <button 
            onClick={onUndo} 
            disabled={!canUndo}
            className={`w-7 h-7 sm:w-8 sm:h-8 landscape:w-6 landscape:h-6 md:landscape:w-8 md:landscape:h-8 rounded-lg flex items-center justify-center transition-colors ${canUndo ? 'text-slate-300 hover:text-white hover:bg-slate-800 active:scale-90' : 'text-slate-700 cursor-not-allowed opacity-40'}`}
            title="Назад (Undo)"
            aria-label="Назад"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button 
            onClick={onRedo} 
            disabled={!canRedo}
            className={`w-7 h-7 sm:w-8 sm:h-8 landscape:w-6 landscape:h-6 md:landscape:w-8 md:landscape:h-8 rounded-lg flex items-center justify-center transition-colors ${canRedo ? 'text-slate-300 hover:text-white hover:bg-slate-800 active:scale-90' : 'text-slate-700 cursor-not-allowed opacity-40'}`}
            title="Вперед (Redo)"
            aria-label="Вперед"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4 text-[11px] sm:text-xs font-mono">
        <div className="flex items-center space-x-1">
          <span className="text-slate-500 uppercase font-medium hidden sm:inline">Чернетка:</span>
          <span className="text-blue-400 font-semibold">{draftCount}PX</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-slate-500 uppercase font-medium hidden sm:inline">Сума:</span>
          <span className="text-slate-200 font-semibold">{draftCost.toFixed(2)}₴</span>
        </div>
        {isAdmin && (
          <div className="items-center space-x-1 hidden md:flex">
            <span className="text-purple-400 uppercase font-medium">ADM:</span>
            <span className="text-white font-semibold">{onlineCount}</span>
          </div>
        )}
      </div>
    </footer>
  );
};

export default BottomBar;
