
import React, { useState } from 'react';
import { Tool, Mode } from '../types';
import { COLORS_STANDARD } from '../constants';

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  selectedColor: string;
  setSelectedColor: (c: string) => void;
  isAdmin: boolean;
  brushSize: number;
  setBrushSize: (s: number) => void;
}

const ToolBar: React.FC<Props> = ({ 
  tool, setTool, mode, onModeChange, selectedColor, setSelectedColor, isAdmin, brushSize, setBrushSize
}) => {
  const [showColorPalette, setShowColorPalette] = useState(false);

  return (
    <div className="absolute right-2 sm:right-3 md:right-4 top-1/2 -translate-y-1/2 z-20 select-none">
      <div className="bg-slate-900/90 backdrop-blur-xl p-1.5 sm:p-2 md:p-2.5 rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col items-center space-y-2 sm:space-y-2.5">
        
        {/* Tools Group */}
        <div className="flex flex-col space-y-1 sm:space-y-1.5">
          <ToolButton 
            active={tool === Tool.REVIEW} 
            onClick={() => setTool(Tool.REVIEW)}
            title="Огляд / Переміщення"
            ariaLabel="Огляд"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />}
          />
          <ToolButton 
            active={tool === Tool.PENCIL} 
            onClick={() => setTool(Tool.PENCIL)}
            title="Олівець"
            ariaLabel="Олівець"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />}
          />
          <ToolButton 
            active={tool === Tool.RECTANGLE} 
            onClick={() => setTool(Tool.RECTANGLE)}
            title="Прямокутна заливка"
            ariaLabel="Заливка"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />}
          />
          <ToolButton 
            active={tool === Tool.ERASER} 
            onClick={() => setTool(Tool.ERASER)}
            title={isAdmin ? "Модерація / Ластик" : "Ластик"}
            ariaLabel="Ластик"
            icon={
              <>
                <rect x="5" y="5" width="14" height="14" rx="2" strokeWidth="2" stroke="currentColor" />
                <path d="M5 12h14" strokeWidth="2" stroke="currentColor" />
              </>
            }
          />
        </div>

        <div className="w-5 sm:w-6 h-px bg-slate-800"></div>

        {/* STD / VIP Toggle */}
        <div className="flex flex-col space-y-1">
          <button 
            className={`w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 landscape:w-7 landscape:h-7 md:landscape:w-8.5 md:landscape:h-8.5 rounded-xl flex items-center justify-center font-bold text-[9px] sm:text-[10px] transition-all ${mode === Mode.STANDARD ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 bg-slate-800/80 hover:text-white'}`}
            onClick={() => onModeChange(Mode.STANDARD)}
            title="Стандартний режим"
          >
            STD
          </button>
          <button 
            className={`w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 landscape:w-7 landscape:h-7 md:landscape:w-8.5 md:landscape:h-8.5 rounded-xl flex items-center justify-center font-bold text-[9px] sm:text-[10px] transition-all ${mode === Mode.VIP ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 bg-slate-800/80 hover:text-white'}`}
            onClick={() => onModeChange(Mode.VIP)}
            title="VIP режим"
          >
            VIP
          </button>
        </div>

        <div className="w-5 sm:w-6 h-px bg-slate-800"></div>

        {/* Color Picker Swatch & Expandable Popover */}
        <div className="relative">
          {mode === Mode.STANDARD ? (
            <>
              <button
                onClick={() => setShowColorPalette(prev => !prev)}
                className="w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 landscape:w-7 landscape:h-7 md:landscape:w-8.5 md:landscape:h-8.5 rounded-xl border-2 border-white/80 shadow-md flex items-center justify-center transition-transform active:scale-90"
                style={{ backgroundColor: selectedColor }}
                title="Вибрати колір"
                aria-label="Вибрати колір"
              >
                <div className="w-2 h-2 rounded-full bg-black/30 border border-white/50" />
              </button>

              {/* Flyout Color Grid (pops out to the left) */}
              {showColorPalette && (
                <div 
                  className="absolute right-full top-1/2 -translate-y-1/2 mr-2 bg-slate-900/95 backdrop-blur-xl p-2.5 rounded-2xl border border-slate-700 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150"
                  style={{ width: '150px' }}
                >
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Палітра</span>
                    <button 
                      onClick={() => setShowColorPalette(false)} 
                      className="text-slate-500 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {COLORS_STANDARD.map(c => (
                      <button
                        key={c}
                        className={`w-7 h-7 rounded-lg border transition-transform ${selectedColor === c ? 'border-white scale-110 shadow-md ring-2 ring-blue-500' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                        onClick={() => {
                          setSelectedColor(c);
                          setShowColorPalette(false);
                        }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center">
              <label 
                className="w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 landscape:w-7 landscape:h-7 md:landscape:w-8.5 md:landscape:h-8.5 rounded-xl border-2 border-amber-400/80 shadow-md flex items-center justify-center cursor-pointer transition-transform active:scale-90 overflow-hidden"
                style={{ backgroundColor: selectedColor }}
                title="VIP Колір"
              >
                <input 
                  type="color" 
                  className="opacity-0 w-0 h-0 pointer-events-none"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                />
                <span className="text-[10px] font-bold text-white drop-shadow">🎨</span>
              </label>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

const ToolButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, title: string, ariaLabel: string }> = ({ 
  active, onClick, icon, title, ariaLabel 
}) => (
  <button 
    onClick={onClick} 
    title={title}
    aria-label={ariaLabel}
    className={`w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 landscape:w-7 landscape:h-7 md:landscape:w-8.5 md:landscape:h-8.5 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-blue-600 text-white shadow-md scale-105' : 'text-slate-400 hover:text-white hover:bg-slate-800/80'}`}
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 landscape:h-3.5 landscape:w-3.5 md:landscape:h-4 md:landscape:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icon}
    </svg>
  </button>
);

export default ToolBar;
