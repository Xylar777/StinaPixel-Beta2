
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PublishedArt } from '../types';
import { getArtPixelsDB } from '../db';

interface Props {
  onBack: () => void;
  onGoToLocation: (x: number, y: number) => void;
  onViewProfile: (id: string) => void;
  currentUserId: string;
  isAdmin?: boolean;
}

const Museum: React.FC<Props> = ({ onBack, onGoToLocation, onViewProfile, currentUserId, isAdmin }) => {
  const [gallery, setGallery] = useState<PublishedArt[]>([]);
  const [archive, setArchive] = useState<PublishedArt[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular' | 'archive'>('newest');

  useEffect(() => {
    refreshGallery();
  }, []);

  const refreshGallery = () => {
    const savedGallery = localStorage.getItem('stnapixel_museum_gallery');
    if (savedGallery) setGallery(JSON.parse(savedGallery));
    
    const savedArchive = localStorage.getItem('stnapixel_museum_archive');
    if (savedArchive) setArchive(JSON.parse(savedArchive));
  };

  const currentList = useMemo(() => sortBy === 'archive' ? archive : gallery, [gallery, archive, sortBy]);

  const sortedGallery = useMemo(() => {
    return [...currentList].sort((a, b) => {
      if (sortBy === 'popular') return (b.likes || 0) - (a.likes || 0);
      if (sortBy === 'oldest') return a.timestamp - b.timestamp;
      return b.timestamp - a.timestamp;
    });
  }, [currentList, sortBy]);

  const handleLike = (artId: string) => {
    const update = (list: PublishedArt[]) => list.map(art => {
      if (art.id === artId) {
        const likedBy = art.likedBy || [];
        const index = likedBy.indexOf(currentUserId);
        if (index === -1) likedBy.push(currentUserId);
        else likedBy.splice(index, 1);
        return { ...art, likedBy, likes: likedBy.length };
      }
      return art;
    });
    const updatedG = update(gallery); const updatedA = update(archive);
    setGallery(updatedG); setArchive(updatedA);
    localStorage.setItem('stnapixel_museum_gallery', JSON.stringify(updatedG));
    localStorage.setItem('stnapixel_museum_archive', JSON.stringify(updatedA));
  };

  const handleArchiveArt = async (artId: string) => {
    if (!confirm("ПЕРЕМІСТИТИ В АРХІВ?\n\n- Місце на стіні буде звільнено.\n- Арт зникне з головної галереї.\n- Робота залишиться в розділі 'Архів'.")) return;
    
    try {
      const artToArchive = gallery.find(a => a.id === artId);
      if (!artToArchive) return;

      // 1. Physical removal from wall (simulated here by updating DB if we had access, 
      // but Museum mostly deals with metadata. However, MainWall handles the actual pixels.
      // To be consistent, we should trigger a refresh on the wall if possible, 
      // but here we just update the museum lists.)
      
      const updatedGallery = gallery.filter(a => a.id !== artId);
      const updatedArchive = [
        { ...artToArchive, isArchived: true, isDeletedFromWall: true },
        ...archive
      ];

      setGallery(updatedGallery);
      setArchive(updatedArchive);
      localStorage.setItem('stnapixel_museum_gallery', JSON.stringify(updatedGallery));
      localStorage.setItem('stnapixel_museum_archive', JSON.stringify(updatedArchive));

      // Also update user history
      const histKey = `stnapixel_user_history_${artToArchive.ownerId}`;
      const userHist = JSON.parse(localStorage.getItem(histKey) || '[]');
      const updatedHist = userHist.map((a: PublishedArt) => 
        a.id === artId ? { ...a, isArchived: true, isDeletedFromWall: true } : a
      );
      localStorage.setItem(histKey, JSON.stringify(updatedHist));

      // Notify wall to refresh if it's open (though Museum is a separate page)
      window.dispatchEvent(new CustomEvent('stnapixel_refresh_wall'));
      
      alert("Арт переміщено в архів.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteArt = (artId: string) => {
    if (!confirm("ВИДАЛИТИ НАЗАВЖДИ?\n\n- Арт буде повністю видалено з Музею та історії.")) return;
    
    const updatedGallery = gallery.filter(a => a.id !== artId);
    const updatedArchive = archive.filter(a => a.id !== artId);
    
    setGallery(updatedGallery);
    setArchive(updatedArchive);
    localStorage.setItem('stnapixel_museum_gallery', JSON.stringify(updatedGallery));
    localStorage.setItem('stnapixel_museum_archive', JSON.stringify(updatedArchive));

    // Remove from user history too
    const art = gallery.find(a => a.id === artId) || archive.find(a => a.id === artId);
    if (art) {
      const histKey = `stnapixel_user_history_${art.ownerId}`;
      const userHist = JSON.parse(localStorage.getItem(histKey) || '[]');
      const updatedHist = userHist.filter((a: PublishedArt) => a.id !== artId);
      localStorage.setItem(histKey, JSON.stringify(updatedHist));
    }

    alert("Арт видалено назавжди.");
  };

  return (
    <div className="flex-1 bg-slate-950 overflow-y-auto p-3.5 sm:p-6 md:p-12 relative custom-scrollbar">
      <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-6 sm:mb-10 md:mb-16 gap-4 sm:gap-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center md:items-start text-center md:text-left w-full md:w-auto">
          <button onClick={onBack} className="mb-3 sm:mb-6 w-fit bg-slate-900/80 hover:bg-slate-800 text-slate-300 px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl border border-slate-800 transition-all flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
            <span className="font-bold uppercase tracking-wider text-[10px] sm:text-xs">Стіна</span>
          </button>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight uppercase leading-none mb-1 sm:mb-2">NFT<span className="text-blue-500">.МУЗЕЙ</span></h2>
          <p className="text-slate-400 font-medium uppercase tracking-wider text-[10px] sm:text-xs">Цифрова спадщина проекту</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 bg-slate-900/90 p-1 sm:p-1.5 rounded-2xl border border-slate-800 shadow-xl">
          <FilterBtn active={sortBy === 'newest'} onClick={() => setSortBy('newest')} label="НОВІ" />
          <FilterBtn active={sortBy === 'popular'} onClick={() => setSortBy('popular')} label="ТОП" />
          <FilterBtn active={sortBy === 'archive'} onClick={() => setSortBy('archive')} label="АРХІВ" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto">
        {currentList.length === 0 ? (
          <div className="py-16 md:py-36 text-center opacity-30 font-bold uppercase text-base sm:text-xl tracking-widest">Галерея порожня</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 landscape:grid-cols-2 md:landscape:grid-cols-3">
            {sortedGallery.map((art, idx) => (
              <ArtCard 
                key={`${art.id}-${idx}`} 
                art={art} 
                onGoToLocation={onGoToLocation} 
                onViewProfile={onViewProfile} 
                handleLike={handleLike} 
                currentUserId={currentUserId} 
                isAdmin={isAdmin}
                onArchive={() => handleArchiveArt(art.id)}
                onDelete={() => handleDeleteArt(art.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FilterBtn = ({ active, onClick, label }: any) => (
  <button onClick={onClick} className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>{label}</button>
);

const ArtCard = ({ art, onGoToLocation, onViewProfile, handleLike, currentUserId, isAdmin, onArchive, onDelete }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isLiked = art.likedBy?.includes(currentUserId);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    getArtPixelsDB(art.id).then(artPixels => {
      if (!artPixels) return;
      const coords = Object.keys(artPixels).map(k => k.split(',').map(Number));
      const minX = Math.min(...coords.map(c => c[0])), maxX = Math.max(...coords.map(c => c[0]));
      const minY = Math.min(...coords.map(c => c[1])), maxY = Math.max(...coords.map(c => c[1]));
      const width = maxX - minX + 1, height = maxY - minY + 1;
      canvas.width = 400; canvas.height = 400;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 400, 400);
      const scale = Math.min(360 / width, 360 / height, 20);
      const offX = (400 - width * scale) / 2, offY = (400 - height * scale) / 2;
      Object.entries(artPixels).forEach(([coord, color]: [string, any]) => {
        const [lx, ly] = coord.split(',').map(Number);
        ctx.fillStyle = color;
        // ПІКСЕЛЬНА СТРУКТУРА В КАРТЦІ
        const gap = scale > 5 ? 1 : 0;
        ctx.fillRect(offX + (lx - minX) * scale, offY + (ly - minY) * scale, scale - gap, scale - gap);
      });
    });
  }, [art]);

  return (
    <div className="bg-slate-900/80 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-slate-800 hover:border-blue-600/50 transition-all duration-300 flex flex-col group relative">
      <div className="aspect-square bg-white flex items-center justify-center p-4 sm:p-6 md:p-8 relative">
        {art.isVIP && <span className="absolute top-3 right-3 sm:top-5 sm:right-5 bg-amber-500 text-black text-[9px] sm:text-[10px] font-bold px-3 py-1 rounded-full uppercase z-10 shadow-md">VIP</span>}
        <canvas ref={canvasRef} className="w-full h-full rounded-xl sm:rounded-2xl object-contain pointer-events-none group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-4 sm:p-6 flex-1 flex flex-col">
        <h4 className="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight truncate mb-1.5 sm:mb-2">"{art.description || 'Арт'}"</h4>
        <div className="flex items-center space-x-2.5 sm:space-x-3 mb-3 sm:mb-6 cursor-pointer" onClick={() => onViewProfile(art.ownerId)}>
          <div className="w-7 h-7 sm:w-9 sm:h-9 bg-blue-600 rounded-xl flex items-center justify-center text-[10px] sm:text-xs text-white font-bold">{art.ownerName[0]?.toUpperCase()}</div>
          <span className="text-xs sm:text-sm text-slate-300 font-semibold hover:text-blue-400 transition-colors">{art.ownerName}</span>
        </div>
        <div className="mt-auto pt-3 sm:pt-4 border-t border-slate-800 flex justify-between items-center">
           <div className="flex space-x-1.5 sm:space-x-2">
              {!art.isArchived ? (
                <button onClick={() => onGoToLocation(art.centerX, art.centerY)} className="bg-slate-800 hover:bg-blue-600 text-white font-bold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl uppercase tracking-wider text-[9px] sm:text-[10px] transition-all">Знайти</button>
              ) : (
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">В архіві</span>
              )}
              {isAdmin && (
                <div className="flex space-x-1 sm:space-x-1.5">
                  {!art.isArchived && (
                    <button onClick={onArchive} title="В архів" className="bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white p-2 rounded-xl border border-amber-600/30 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                    </button>
                  )}
                  <button onClick={onDelete} title="Видалити" className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-2 rounded-xl border border-red-600/30 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              )}
           </div>
           <button onClick={() => handleLike(art.id)} className={`flex items-center space-x-1.5 sm:space-x-2 ${isLiked ? 'text-red-500' : 'text-slate-500 hover:text-slate-300'}`} aria-label="Лайк">
             <span className="font-bold text-xs sm:text-sm font-mono">{art.likes || 0}</span>
             <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 sm:h-6 sm:w-6 ${isLiked ? 'fill-red-600' : 'fill-none'}`} stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
           </button>
        </div>
      </div>
    </div>
  );
};

export default Museum;
