
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Tool, Mode, PixelData, PublishedArt } from '../types';
import { COLORS_STANDARD, CANVAS_SIZE, COST_STANDARD, COST_VIP } from '../constants';
import { saveCanvasPixelsDB, getCanvasPixelsDB, saveArtPixelsDB, deleteCanvasPixelsDB, saveCanvasBatchServer } from '../db';
import { realtimeClient } from '../utils/realtime';
import { subscribeToSupabaseRealtime } from '../utils/supabase';
import { sound } from '../utils/audio';
import ToolBar from './ToolBar';
import TopBar from './TopBar';
import BottomBar from './BottomBar';
import BonusCase from './BonusCase';

interface Props {
  user: User;
  onNavigate: (page: 'landing' | 'wall' | 'admin' | 'museum' | 'profile') => void;
  onViewProfile: (id: string) => void;
  updateBalance: (amount: number) => void;
  onLogout: () => void;
  targetLocation: {x: number, y: number} | null;
  clearTargetLocation: () => void;
}

const MainWall: React.FC<Props> = ({ user, onNavigate, onViewProfile, updateBalance, onLogout, targetLocation, clearTargetLocation }) => {
  const isGuest = user.id === 'GUEST';
  const [tool, setTool] = useState<Tool>(Tool.REVIEW);
  const [mode, setMode] = useState<Mode>(Mode.STANDARD);
  const [selectedColor, setSelectedColor] = useState(COLORS_STANDARD[1]); 
  const [brushSize, setBrushSize] = useState(1);

  const getBarHeights = useCallback(() => {
    const isLandscape = window.innerWidth > window.innerHeight;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      if (isLandscape) {
        return 44 + 26; // landscape:h-11 (44px) + landscape:h-6.5 (26px)
      }
      return 56 + 34; // portrait:h-14 (56px) + portrait:h-8.5 (34px)
    }
    return 72 + 40; // desktop md:h-18 (72px) + md:h-10 (40px)
  }, []);

  const [dimensions, setDimensions] = useState({ 
    width: window.innerWidth, 
    height: Math.max(200, window.innerHeight - getBarHeights()) 
  });

  const [zoom, setZoom] = useState(0.01); 
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  const [hoverCoord, setHoverCoord] = useState({ x: 0, y: 0 });
  const [showCase, setShowCase] = useState(false);

  // Touch gesture refs
  const touchStartDist = useRef<number | null>(null);
  const touchStartCenter = useRef<{ x: number, y: number } | null>(null);
  const touchStartViewPos = useRef<{ x: number, y: number } | null>(null);
  const touchStartZoom = useRef<number>(1);
  
  const [hoveredPixelData, setHoveredPixelData] = useState<PixelData | null>(null);
  const [selectedPixelData, setSelectedPixelData] = useState<PixelData | null>(null);
  const [stickyCoord, setStickyCoord] = useState({ x: 0, y: 0 });

  const [adminSelectedArtId, setAdminSelectedArtId] = useState<string | null>(null);
  const [adminSelectedPixelCoord, setAdminSelectedPixelCoord] = useState<string | null>(null);

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [pubName, setPubName] = useState('');
  const [pubComment, setPubComment] = useState('');
  const [pubLink, setPubLink] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  
  const [pixels, setPixels] = useState<Map<string, PixelData>>(new Map());
  
  const refreshPixels = useCallback(async () => {
    try {
      const dbPixels = await getCanvasPixelsDB();
      setPixels(dbPixels);
    } catch (err) {
      console.error("Failed to load pixels:", err);
    }
  }, []);

  useEffect(() => {
    realtimeClient.setUser(user.id, user.username);
    refreshPixels();
    const handleRefresh = () => refreshPixels();
    window.addEventListener('stnapixel_refresh_wall', handleRefresh);

    const unsubRealtime = realtimeClient.subscribe((evt) => {
      if (evt.type === 'canvas:batch_update' && evt.payload?.updates) {
        setPixels(prev => {
          const next = new Map(prev);
          for (const [key, p] of evt.payload.updates) {
            next.set(key, p);
          }
          return next;
        });
      } else if (evt.type === 'canvas:rollback' && evt.payload?.updates) {
        setPixels(prev => {
          const next = new Map(prev);
          for (const [key, p] of evt.payload.updates) {
            if (p) next.set(key, p);
            else next.delete(key);
          }
          return next;
        });
      }
    });

    const unsubSupabase = subscribeToSupabaseRealtime(({ key, data }) => {
      setPixels(prev => {
        const next = new Map(prev);
        next.set(key, data);
        return next;
      });
    });

    return () => {
      window.removeEventListener('stnapixel_refresh_wall', handleRefresh);
      unsubRealtime();
      unsubSupabase();
    };
  }, [refreshPixels, user.id, user.username]);

  const [draftPixels, setDraftPixels] = useState<Map<string, string>>(new Map());
  const [history, setHistory] = useState<Map<string, string>[]>([]);
  const [redoStack, setRedoStack] = useState<Map<string, string>[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPanning = useRef(false);
  const isDrawing = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const rectStartPos = useRef<{ x: number, y: number } | null>(null);

  const getMinZoom = useCallback(() => {
    const padding = 40;
    return Math.min(dimensions.width - padding, dimensions.height - padding) / CANVAS_SIZE;
  }, [dimensions]);

  useEffect(() => {
    if (targetLocation) {
      setZoom(10);
      setViewPos({
        x: targetLocation.x - (dimensions.width / 2) / 10,
        y: targetLocation.y - (dimensions.height / 2) / 10
      });
      clearTargetLocation();
    }
  }, [targetLocation, dimensions, clearTargetLocation]);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ 
        width: window.innerWidth, 
        height: window.innerHeight - getBarHeights() 
      });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [getBarHeights]);

  useEffect(() => {
    if (!targetLocation) {
      const minZoom = getMinZoom();
      setZoom(minZoom);
      setViewPos({
        x: (CANVAS_SIZE - dimensions.width / minZoom) / 2,
        y: (CANVAS_SIZE - dimensions.height / minZoom) / 2
      });
    }
  }, [dimensions, getMinZoom, targetLocation]);

  const saveToHistory = () => {
    setHistory(prev => [...prev, new Map(draftPixels)]);
    setRedoStack([]);
  };

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(rs => [...rs, new Map(draftPixels)]);
    setDraftPixels(prev);
    setHistory(h => h.slice(0, -1));
  }, [history, draftPixels]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(h => [...h, new Map(draftPixels)]);
    setDraftPixels(next);
    setRedoStack(rs => rs.slice(0, -1));
  }, [redoStack, draftPixels]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#020617'; 
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    const wallLeft = -viewPos.x * zoom;
    const wallTop = -viewPos.y * zoom;
    const wallSize = CANVAS_SIZE * zoom;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(wallLeft, wallTop, wallSize, wallSize);

    ctx.save();
    ctx.beginPath();
    ctx.rect(wallLeft, wallTop, wallSize, wallSize);
    ctx.clip();

    const startX = Math.max(0, Math.floor(viewPos.x));
    const startY = Math.max(0, Math.floor(viewPos.y));
    const endX = Math.min(CANVAS_SIZE, Math.ceil(viewPos.x + dimensions.width / zoom));
    const endY = Math.min(CANVAS_SIZE, Math.ceil(viewPos.y + dimensions.height / zoom));

    // КЛАСИЧНА СІТКА
    if (zoom > 4) {
      ctx.beginPath(); 
      ctx.strokeStyle = '#cbd5e1'; 
      ctx.lineWidth = 0.5;
      for (let lx = startX; lx <= endX; lx++) {
        const sx = (lx - viewPos.x) * zoom;
        ctx.moveTo(sx, wallTop); 
        ctx.lineTo(sx, wallTop + wallSize);
      }
      for (let ly = startY; ly <= endY; ly++) {
        const sy = (ly - viewPos.y) * zoom;
        ctx.moveTo(wallLeft, sy); 
        ctx.lineTo(wallLeft + wallSize, sy);
      }
      ctx.stroke();
    }

    // КЛАСИЧНИЙ ПІКСЕЛЬНИЙ РЕНДЕР (З ПРОМІЖКОМ)
    pixels.forEach((data: PixelData, coord) => {
      const [lx, ly] = coord.split(',').map(Number);
      if (lx >= startX && lx <= endX && ly >= startY && ly <= endY) {
        ctx.fillStyle = data.color;
        const gap = zoom > 8 ? 0.4 : 0; 
        ctx.fillRect((lx - viewPos.x) * zoom, (ly - viewPos.y) * zoom, zoom - gap, zoom - gap);

        if (user.isAdmin && tool === Tool.ERASER) {
          if (adminSelectedArtId && data.artId === adminSelectedArtId) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; 
            ctx.fillRect((lx - viewPos.x) * zoom, (ly - viewPos.y) * zoom, zoom, zoom);
          } else if (adminSelectedPixelCoord === coord) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
            ctx.fillRect((lx - viewPos.x) * zoom, (ly - viewPos.y) * zoom, zoom, zoom);
          }
        }
      }
    });

    if (!isGuest) {
      ctx.globalAlpha = 0.8;
      draftPixels.forEach((color, coord) => {
        const [lx, ly] = coord.split(',').map(Number);
        if (lx >= startX && lx <= endX && ly >= startY && ly <= endY) {
          ctx.fillStyle = color;
          ctx.fillRect((lx - viewPos.x) * zoom, (ly - viewPos.y) * zoom, zoom, zoom);
        }
      });
      ctx.globalAlpha = 1.0;
    }

    if (tool === Tool.RECTANGLE && rectStartPos.current && isDrawing.current && !isGuest) {
      const current = screenToLogical(lastMousePos.current.x, lastMousePos.current.y);
      const x = Math.min(rectStartPos.current.x, current.x);
      const y = Math.min(rectStartPos.current.y, current.y);
      const w = Math.abs(rectStartPos.current.x - current.x) + 1;
      const h = Math.abs(rectStartPos.current.y - current.y) + 1;
      ctx.fillStyle = selectedColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect((x - viewPos.x) * zoom, (y - viewPos.y) * zoom, w * zoom, h * zoom);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect((x - viewPos.x) * zoom, (y - viewPos.y) * zoom, w * zoom, h * zoom);
    }

    ctx.restore();
    ctx.strokeStyle = '#3b82f6'; 
    ctx.lineWidth = 2;
    ctx.strokeRect(wallLeft, wallTop, wallSize, wallSize);
  }, [pixels, draftPixels, zoom, viewPos, dimensions, tool, selectedColor, isGuest, user.isAdmin, adminSelectedArtId, adminSelectedPixelCoord]);

  useEffect(() => {
    const frame = requestAnimationFrame(renderCanvas);
    return () => cancelAnimationFrame(frame);
  }, [renderCanvas]);

  const screenToLogical = (sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor(viewPos.x + (sx - rect.left) / zoom),
      y: Math.floor(viewPos.y + (sy - rect.top) / zoom)
    };
  };

  // АРХІВУВАННЯ АРТУ (ЗВІЛЬНЕННЯ СТІНИ)
  const handleArchiveArt = async (artId: string) => {
    if (!confirm("ПЕРЕМІСТИТИ В АРХІВ?\n\n- Місце на стіні буде звільнено.\n- Арт зникне з головної галереї Музею.\n- Робота залишиться в розділі 'Архів' для історії.")) return;
    
    const nextPixelsMap = new Map<string, PixelData>(pixels);
    const toClearCoords: string[] = [];
    
    nextPixelsMap.forEach((data: PixelData, coord) => {
      if (data.artId === artId) {
        toClearCoords.push(coord);
        nextPixelsMap.delete(coord);
      }
    });

    if (toClearCoords.length > 0) {
      try {
        // 1. Звільняємо стіну фізично
        await deleteCanvasPixelsDB(toClearCoords);
        setPixels(new Map(nextPixelsMap));

        // 2. Оновлюємо списки (Переміщуємо з Галереї в Архів)
        const musRaw = localStorage.getItem('stnapixel_museum_gallery');
        const arcRaw = localStorage.getItem('stnapixel_museum_archive');
        
        if (musRaw) {
          const gallery = JSON.parse(musRaw);
          const artToArchive = gallery.find((a: PublishedArt) => a.id === artId);
          if (artToArchive) {
            const updatedGallery = gallery.filter((a: PublishedArt) => a.id !== artId);
            const archive = arcRaw ? JSON.parse(arcRaw) : [];
            
            artToArchive.isArchived = true;
            artToArchive.isDeletedFromWall = true;
            
            localStorage.setItem('stnapixel_museum_gallery', JSON.stringify(updatedGallery));
            localStorage.setItem('stnapixel_museum_archive', JSON.stringify([artToArchive, ...archive]));
          }
        }

        // 3. Оновлюємо історію користувачів (позначаємо як архівований)
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('stnapixel_user_history_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
               const hist = JSON.parse(raw).map((a: PublishedArt) => 
                 a.id === artId ? { ...a, isArchived: true, isDeletedFromWall: true } : a
               );
               localStorage.setItem(key, JSON.stringify(hist));
            }
          }
        }

        alert("Арт переміщено в архів. Місце на стіні вільне.");
        setAdminSelectedArtId(null); setAdminSelectedPixelCoord(null); setSelectedPixelData(null);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleWipeSinglePixel = async (coord: string) => {
    if (!confirm("Стерти цей піксель?")) return;
    try {
      await deleteCanvasPixelsDB([coord]);
      setPixels(prev => {
        const next = new Map(prev);
        next.delete(coord);
        return next;
      });
      setAdminSelectedPixelCoord(null); setAdminSelectedArtId(null);
    } catch (e) { console.error(e); }
  };

  const applyTool = (lx: number, ly: number) => {
    if (isGuest) return;
    if (lx < 0 || lx >= CANVAS_SIZE || ly < 0 || ly >= CANVAS_SIZE) return;
    const key = `${lx},${ly}`;
    const existing = pixels.get(key);

    if (tool === Tool.PENCIL) {
      if (existing?.isVIP && !user.isAdmin) return;
      sound.playDraw();
      setDraftPixels(prev => {
        const next = new Map(prev);
        next.set(key, selectedColor);
        return next;
      });
    } else if (tool === Tool.ERASER) {
      if (user.isAdmin && existing) {
        setAdminSelectedPixelCoord(key);
        setAdminSelectedArtId(existing.artId || null);
        return;
      }
      const newDraft = new Map(draftPixels);
      newDraft.delete(key);
      setDraftPixels(newDraft);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const logical = screenToLogical(e.clientX, e.clientY);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (tool === Tool.REVIEW || e.button === 1 || isGuest) {
      isPanning.current = true;
      const data = pixels.get(`${logical.x},${logical.y}`);
      if (data) { 
        setStickyCoord(logical); 
        setSelectedPixelData(data); 
      } else { 
        setSelectedPixelData(null); 
      }
    } else {
      saveToHistory();
      isDrawing.current = true;
      setSelectedPixelData(null); 
      if (tool === Tool.RECTANGLE) rectStartPos.current = logical;
      else applyTool(logical.x, logical.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const logical = screenToLogical(e.clientX, e.clientY);
    setHoverCoord({ x: Math.max(0, Math.min(CANVAS_SIZE-1, logical.x)), y: Math.max(0, Math.min(CANVAS_SIZE-1, logical.y)) });
    if (tool === Tool.REVIEW || isGuest) {
      setHoveredPixelData(pixels.get(`${logical.x},${logical.y}`) || null);
    } else {
      setHoveredPixelData(null);
    }
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setViewPos(p => ({ x: p.x - dx / zoom, y: p.y - dy / zoom }));
    } else if (isDrawing.current && (tool === Tool.PENCIL || (tool === Tool.ERASER && !user.isAdmin))) {
      applyTool(logical.x, logical.y);
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (tool === Tool.RECTANGLE && rectStartPos.current && isDrawing.current && !isGuest) {
      const cur = screenToLogical(e.clientX, e.clientY);
      const xS = Math.min(rectStartPos.current.x, cur.x); const xE = Math.max(rectStartPos.current.x, cur.x);
      const yS = Math.min(rectStartPos.current.y, cur.y); const yE = Math.max(rectStartPos.current.y, cur.y);
      const nD = new Map(draftPixels);
      for (let x = xS; x <= xE; x++) {
        for (let y = yS; y <= yE; y++) {
          if (x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE) {
            const exp = pixels.get(`${x},${y}`);
            if (!exp?.isVIP || user.isAdmin) nD.set(`${x},${y}`, selectedColor);
          }
        }
      }
      setDraftPixels(nD);
      rectStartPos.current = null;
    }
    isPanning.current = false; isDrawing.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const cur = screenToLogical(e.clientX, e.clientY);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const delta = e.deltaY > 0 ? 0.8 : 1.25;
    const nZ = Math.min(150, Math.max(getMinZoom(), zoom * delta));
    setViewPos({ x: cur.x - (e.clientX - rect.left) / nZ, y: cur.y - (e.clientY - rect.top) / nZ });
    setZoom(nZ);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const logical = screenToLogical(t.clientX, t.clientY);
      lastMousePos.current = { x: t.clientX, y: t.clientY };
      setHoverCoord({ x: Math.max(0, Math.min(CANVAS_SIZE-1, logical.x)), y: Math.max(0, Math.min(CANVAS_SIZE-1, logical.y)) });

      if (tool === Tool.REVIEW || isGuest) {
        isPanning.current = true;
        const data = pixels.get(`${logical.x},${logical.y}`);
        if (data) { 
          setStickyCoord(logical); 
          setSelectedPixelData(data); 
        } else { 
          setSelectedPixelData(null); 
        }
      } else {
        saveToHistory();
        isDrawing.current = true;
        setSelectedPixelData(null); 
        if (tool === Tool.RECTANGLE) rectStartPos.current = logical;
        else applyTool(logical.x, logical.y);
      }
    } else if (e.touches.length === 2) {
      // Two-finger gesture: pinch-zoom & pan
      isPanning.current = false;
      isDrawing.current = false;
      rectStartPos.current = null;

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const center = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };

      touchStartDist.current = dist;
      touchStartCenter.current = center;
      touchStartViewPos.current = { ...viewPos };
      touchStartZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && !touchStartDist.current) {
      const t = e.touches[0];
      const logical = screenToLogical(t.clientX, t.clientY);
      setHoverCoord({ x: Math.max(0, Math.min(CANVAS_SIZE-1, logical.x)), y: Math.max(0, Math.min(CANVAS_SIZE-1, logical.y)) });

      if (isPanning.current) {
        const dx = t.clientX - lastMousePos.current.x;
        const dy = t.clientY - lastMousePos.current.y;
        setViewPos(p => ({ x: p.x - dx / zoom, y: p.y - dy / zoom }));
      } else if (isDrawing.current && (tool === Tool.PENCIL || (tool === Tool.ERASER && !user.isAdmin))) {
        applyTool(logical.x, logical.y);
      }
      lastMousePos.current = { x: t.clientX, y: t.clientY };
    } else if (e.touches.length === 2 && touchStartDist.current && touchStartCenter.current && touchStartViewPos.current) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const newDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const newCenter = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };

      const scaleFactor = newDist / touchStartDist.current;
      const minZ = getMinZoom();
      const nZ = Math.min(150, Math.max(minZ, touchStartZoom.current * scaleFactor));

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const anchorLogicalX = touchStartViewPos.current.x + (touchStartCenter.current.x - rect.left) / touchStartZoom.current;
        const anchorLogicalY = touchStartViewPos.current.y + (touchStartCenter.current.y - rect.top) / touchStartZoom.current;

        const newViewX = anchorLogicalX - (newCenter.x - rect.left) / nZ;
        const newViewY = anchorLogicalY - (newCenter.y - rect.top) / nZ;

        setZoom(nZ);
        setViewPos({ x: newViewX, y: newViewY });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      if (tool === Tool.RECTANGLE && rectStartPos.current && isDrawing.current && !isGuest) {
        const cur = screenToLogical(lastMousePos.current.x, lastMousePos.current.y);
        const xS = Math.min(rectStartPos.current.x, cur.x); const xE = Math.max(rectStartPos.current.x, cur.x);
        const yS = Math.min(rectStartPos.current.y, cur.y); const yE = Math.max(rectStartPos.current.y, cur.y);
        const nD = new Map(draftPixels);
        for (let x = xS; x <= xE; x++) {
          for (let y = yS; y <= yE; y++) {
            if (x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE) {
              const exp = pixels.get(`${x},${y}`);
              if (!exp?.isVIP || user.isAdmin) nD.set(`${x},${y}`, selectedColor);
            }
          }
        }
        setDraftPixels(nD);
        rectStartPos.current = null;
      }
      isPanning.current = false;
      isDrawing.current = false;
      touchStartDist.current = null;
      touchStartCenter.current = null;
      touchStartViewPos.current = null;
    } else if (e.touches.length === 1) {
      touchStartDist.current = null;
      touchStartCenter.current = null;
      touchStartViewPos.current = null;
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleQuickZoom = (factor: number) => {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const curLogical = screenToLogical(centerX, centerY);
    const minZ = getMinZoom();
    const nZ = Math.min(150, Math.max(minZ, zoom * factor));
    setViewPos({
      x: curLogical.x - centerX / nZ,
      y: curLogical.y - centerY / nZ
    });
    setZoom(nZ);
  };

  const handleFitToScreen = () => {
    const minZoom = getMinZoom();
    setZoom(minZoom);
    setViewPos({
      x: (CANVAS_SIZE - dimensions.width / minZoom) / 2,
      y: (CANVAS_SIZE - dimensions.height / minZoom) / 2
    });
  };

  const currentCostPerPixel = mode === Mode.STANDARD ? COST_STANDARD : COST_VIP;
  const totalDraftCost = draftPixels.size * currentCostPerPixel;

  const executePublish = async (isSilent: boolean = false) => {
    setPublishError(null);
    if (!pubName.trim() && !isSilent) return setPublishError("Назва арту є обов'язковою!");
    if (user.balance < totalDraftCost && !user.isAdmin) return setPublishError("Недостатньо коштів!");
    
    setIsPublishing(true);
    const ts = Date.now();
    const artId = isSilent ? undefined : `ART_${ts}_${user.id}`;
    const artPixelStore: { [key: string]: string } = {};
    const dbUpdates: [string, PixelData][] = [];
    let sumX = 0, sumY = 0, count = 0;

    const pixelPayload: { x: number; y: number; color: string }[] = [];
    draftPixels.forEach((c, k) => {
      const [lx, ly] = k.split(',').map(Number);
      sumX += lx; sumY += ly; count++;
      pixelPayload.push({ x: lx, y: ly, color: c });
      if (!isSilent) artPixelStore[k] = c;
      dbUpdates.push([k, { 
        color: c, 
        ownerId: user.id, 
        ownerName: user.username, 
        isVIP: mode === Mode.VIP, 
        timestamp: ts, 
        description: isSilent ? "" : pubName.trim(), 
        artId, 
        link: isSilent ? undefined : (pubLink.trim() || undefined) 
      }]);
    });

    try {
      // 1. Authoritative safe server batch placement
      const serverRes = await saveCanvasBatchServer(
        user,
        pixelPayload,
        mode === Mode.VIP ? 'VIP' : 'STANDARD',
        artId,
        isSilent ? undefined : pubName.trim(),
        isSilent ? undefined : (pubLink.trim() || undefined)
      );

      if (!serverRes.success && serverRes.error) {
        setPublishError(serverRes.error);
        setIsPublishing(false);
        return;
      }

      // 2. Persist to local IndexedDB for immediate responsive rendering
      await saveCanvasPixelsDB(dbUpdates);
      
      if (!isSilent && artId) {
        await saveArtPixelsDB(artId, artPixelStore);
        const art: PublishedArt = { 
          id: artId, ownerId: user.id, ownerName: user.username, pixelCount: count, cost: totalDraftCost, 
          timestamp: ts, isVIP: mode === Mode.VIP, description: pubName.trim(), 
          centerX: Math.floor(sumX/count), centerY: Math.floor(sumY/count), likes: 0, likedBy: [], 
          artPixels: artPixelStore 
        };
        
        const mus = JSON.parse(localStorage.getItem('stnapixel_museum_gallery') || '[]');
        mus.unshift(art); localStorage.setItem('stnapixel_museum_gallery', JSON.stringify(mus));
        
        const uH = JSON.parse(localStorage.getItem(`stnapixel_user_history_${user.id}`) || '[]');
        uH.unshift(art); localStorage.setItem(`stnapixel_user_history_${user.id}`, JSON.stringify(uH));
      }

      await refreshPixels(); 
      if (!user.isAdmin) updateBalance(-totalDraftCost);
      setDraftPixels(new Map()); setIsPublishModalOpen(false); setPubName(''); setPubComment(''); setPubLink('');
      sound.playWin();
    } catch (e) { console.error(e); } finally { setIsPublishing(false); }
  };

  const adminSelectedArtPixelsCount = adminSelectedArtId ? Array.from(pixels.values()).filter((p: PixelData) => p.artId === adminSelectedArtId).length : 0;

  const isAllWhiteDraft = Array.from(draftPixels.values()).every(c => (c as string).toUpperCase() === '#FFFFFF');

  const clampedPopupLeft = selectedPixelData ? Math.max(12, Math.min(dimensions.width - 290, (stickyCoord.x - viewPos.x) * zoom + 15)) : 0;
  const clampedPopupTop = selectedPixelData ? Math.max(12, Math.min(dimensions.height - 220, (stickyCoord.y - viewPos.y) * zoom + 15)) : 0;

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-950 select-none" onWheel={handleWheel}>
      <TopBar user={user} onNavigate={onNavigate} onShowCase={() => setShowCase(true)} onLogout={onLogout} />
      
      <div className="flex-1 overflow-hidden relative cursor-crosshair">
        <canvas 
          ref={canvasRef} 
          width={dimensions.width} 
          height={dimensions.height} 
          onMouseDown={handleMouseDown} 
          onMouseMove={handleMouseMove} 
          onMouseUp={handleMouseUp} 
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{ touchAction: 'none' }}
          className="w-full h-full block"
        />
        
        {hoveredPixelData && !selectedPixelData && (
          <div className="absolute pointer-events-none z-[50] bg-black/85 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-xl animate-in fade-in duration-150" style={{ left: Math.max(8, Math.min(dimensions.width - 190, (hoverCoord.x - viewPos.x) * zoom + 15)), top: Math.max(8, (hoverCoord.y - viewPos.y) * zoom - 55) }}>
            <div className="flex flex-col">
              <span className="text-blue-400 font-bold text-[10px] uppercase tracking-wider">{hoveredPixelData.ownerName}</span>
              <span className="text-white text-xs font-semibold truncate max-w-[170px]">
                {hoveredPixelData.description ? `"${hoveredPixelData.description}"` : "Цифровий арт"}
              </span>
            </div>
          </div>
        )}

        {selectedPixelData && (
          <div 
            className="absolute z-[60] bg-slate-900/95 border border-slate-700/80 p-4 sm:p-5 rounded-2xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 w-[270px] sm:w-[280px]" 
            style={{ left: clampedPopupLeft, top: clampedPopupTop }}
          >
            <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
               <div className="flex flex-col">
                  <span className="text-blue-400 font-bold text-xs uppercase tracking-wider">{selectedPixelData.ownerName}</span>
                  {!isGuest && <span className="text-slate-500 font-mono text-[10px]">#{selectedPixelData.ownerId}</span>}
               </div>
               <button onClick={() => setSelectedPixelData(null)} className="text-slate-400 hover:text-white transition-colors p-1" aria-label="Закрити">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
            </div>
            <div className="mb-4">
              <h4 className="text-white text-sm sm:text-base font-bold tracking-tight line-clamp-2">
                {selectedPixelData.description ? `"${selectedPixelData.description}"` : "Анонімний арт"}
              </h4>
            </div>
            <div className="flex flex-col space-y-1.5">
               <button onClick={() => onViewProfile(selectedPixelData.ownerId)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 rounded-xl transition-all font-bold uppercase tracking-wider shadow-sm">Дивитись профіль</button>
               {selectedPixelData.link && (
                 <a href={selectedPixelData.link.startsWith('http') ? selectedPixelData.link : `https://${selectedPixelData.link}`} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded-xl text-center font-bold uppercase tracking-wider border border-slate-700 transition-all">Веб-сайт автора</a>
               )}
            </div>
          </div>
        )}

        {/* Floating Quick Zoom & Center Control (for phone & tablet navigation) */}
        <div className="absolute left-2.5 sm:left-4 bottom-2.5 sm:bottom-4 z-20 flex flex-col space-y-1.5 select-none">
          <button 
            onClick={() => handleQuickZoom(1.6)}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700/80 shadow-lg flex items-center justify-center font-bold text-base active:scale-90 transition-all backdrop-blur-md"
            title="Наблизити (+)"
            aria-label="Наблизити"
          >
            +
          </button>
          <button 
            onClick={() => handleQuickZoom(0.625)}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700/80 shadow-lg flex items-center justify-center font-bold text-base active:scale-90 transition-all backdrop-blur-md"
            title="Віддалити (−)"
            aria-label="Віддалити"
          >
            −
          </button>
          <button 
            onClick={handleFitToScreen}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700/80 shadow-lg flex items-center justify-center active:scale-90 transition-all backdrop-blur-md"
            title="Показати всю стіну"
            aria-label="Показати всю стіну"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {!isGuest && (
        <ToolBar 
          tool={tool} setTool={(t) => { setTool(t); setAdminSelectedArtId(null); setAdminSelectedPixelCoord(null); }} 
          mode={mode} onModeChange={(m) => { setDraftPixels(new Map()); setMode(m); }} 
          selectedColor={selectedColor} setSelectedColor={setSelectedColor} 
          isAdmin={user.isAdmin} brushSize={brushSize} setBrushSize={setBrushSize}
        />
      )}

      {/* DRAFT UI (Responsive in Portrait & Landscape) */}
      {!isGuest && draftPixels.size > 0 && (
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-auto sm:left-auto sm:right-16 sm:top-1/2 sm:-translate-y-1/2 landscape:bottom-auto landscape:top-2 landscape:right-14 md:landscape:top-1/2 md:landscape:right-16 md:landscape:-translate-y-1/2 bg-slate-900/95 shadow-2xl p-3 sm:p-5 md:p-6 rounded-2xl border border-slate-700 z-[80] sm:min-w-[210px] animate-in slide-in-from-bottom sm:slide-in-from-right duration-250 backdrop-blur-xl flex sm:flex-col items-center justify-between sm:justify-center">
          <div className="flex sm:flex-col items-center sm:text-center space-x-3 sm:space-x-0 sm:mb-4">
             <div className="flex flex-col items-start sm:items-center">
               <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">ЧЕРНЕТКА</span>
               <span className="text-lg sm:text-2xl md:text-3xl font-bold text-white tracking-tight">{draftPixels.size} PX</span>
             </div>
             <div className="hidden sm:block h-px w-8 bg-slate-800 my-2.5"></div>
             <div className="flex flex-col sm:block pl-2.5 sm:pl-0 border-l border-slate-800 sm:border-none">
               <span className={`text-sm sm:text-xl font-bold ${user.balance < totalDraftCost && !user.isAdmin ? 'text-red-400' : 'text-blue-400'}`}>₴{totalDraftCost.toFixed(2)}</span>
             </div>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-0 sm:flex-col sm:w-full sm:space-y-1.5">
            <button 
              onClick={() => setIsPublishModalOpen(true)} 
              disabled={user.balance < totalDraftCost && !user.isAdmin} 
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl uppercase font-bold shadow-md transition-all active:scale-95 text-xs tracking-wider whitespace-nowrap"
            >
              Опублікувати
            </button>
            <button 
              onClick={() => { setDraftPixels(new Map()); setHistory([]); setRedoStack([]); }} 
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 sm:py-2 px-2.5 sm:px-5 rounded-xl transition-all uppercase tracking-wider text-[10px]"
              title="Очистити"
            >
              <span className="hidden sm:inline">Скасувати</span>
              <span className="sm:hidden">✕</span>
            </button>
          </div>
        </div>
      )}

      {/* ADMIN CONTROL - АРХІВУВАННЯ */}
      {user.isAdmin && tool === Tool.ERASER && (adminSelectedArtId || adminSelectedPixelCoord) && (
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-auto sm:left-auto sm:right-16 sm:top-1/2 sm:-translate-y-1/2 landscape:bottom-auto landscape:top-2 landscape:right-14 md:landscape:top-1/2 md:landscape:right-16 md:landscape:-translate-y-1/2 bg-slate-900/95 shadow-2xl p-3 sm:p-5 md:p-6 rounded-2xl border border-slate-700 z-[80] sm:min-w-[210px] animate-in slide-in-from-bottom sm:slide-in-from-right duration-250 backdrop-blur-xl flex sm:flex-col items-center justify-between sm:justify-center">
           <div className="flex sm:flex-col items-center sm:text-center space-x-3 sm:space-x-0 sm:mb-4">
             <div className="flex flex-col items-start sm:items-center">
               <span className="text-blue-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">МОДЕРАЦІЯ</span>
               <span className="text-lg sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
                 {adminSelectedArtId ? `${adminSelectedArtPixelsCount} PX` : '1 PX'}
               </span>
             </div>
             <div className="hidden sm:block h-px w-8 bg-slate-800 my-2.5"></div>
             <p className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase hidden sm:block max-w-[170px] leading-snug">
               {adminSelectedArtId ? "АРХІВУВАТИ АРТ" : "СТЕРТИ ПІКСЕЛЬ"}
             </p>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-0 sm:flex-col sm:w-full sm:space-y-1.5">
            <button 
              onClick={() => adminSelectedArtId ? handleArchiveArt(adminSelectedArtId) : handleWipeSinglePixel(adminSelectedPixelCoord!)} 
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl uppercase font-bold shadow-md transition-all active:scale-95 text-xs tracking-wider whitespace-nowrap"
            >
              В архів
            </button>
            <button 
              onClick={() => { setAdminSelectedArtId(null); setAdminSelectedPixelCoord(null); }} 
              className="text-slate-400 font-bold py-2 px-2.5 sm:px-5 rounded-xl transition-all uppercase tracking-wider text-[10px] hover:text-white bg-slate-800"
            >
              <span className="hidden sm:inline">СКАСУВАТИ</span>
              <span className="sm:hidden">✕</span>
            </button>
          </div>
        </div>
      )}

      {/* ОНОВЛЕНА МОДАЛКА ПУБЛІКАЦІЇ (Responsive in Portrait & Landscape) */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto custom-scrollbar my-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6 pb-2 border-b border-slate-800">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">Публікація арту</h2>
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-600/10 px-2.5 py-1 rounded-lg border border-blue-500/20">{draftPixels.size} PX · ₴{totalDraftCost.toFixed(2)}</span>
            </div>

            {publishError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                {publishError}
              </div>
            )}

            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 block">Назва арту *</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 sm:py-3.5 px-4 text-white font-medium outline-none focus:ring-2 focus:ring-blue-600 text-sm" 
                  placeholder="Приклад: Соняшник" 
                  value={pubName} 
                  onChange={e => setPubName(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 block">Опис / Коментар</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 sm:py-3.5 px-4 text-white outline-none focus:ring-2 focus:ring-blue-600 text-sm" 
                  placeholder="Ваші думки або послання..." 
                  value={pubComment} 
                  onChange={e => setPubComment(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 block">Посилання (сайт / соцмережі)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 sm:py-3.5 px-4 text-white outline-none focus:ring-2 focus:ring-blue-600 text-sm" 
                  placeholder="https://..." 
                  value={pubLink} 
                  onChange={e => setPubLink(e.target.value)} 
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={() => setIsPublishModalOpen(false)} 
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 sm:py-3.5 rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                Назад
              </button>
              <button 
                onClick={() => executePublish(false)} 
                disabled={isPublishing} 
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3 sm:py-3.5 rounded-xl shadow-lg transition-all text-xs uppercase tracking-wider active:scale-95"
              >
                {isPublishing ? 'Публікація...' : `Оплатити ₴${totalDraftCost.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomBar coords={hoverCoord} isAdmin={user.isAdmin} onlineCount={Math.max(1, Math.floor(pixels.size / 2000 + 4))} draftCount={draftPixels.size} draftCost={totalDraftCost} onUndo={handleUndo} onRedo={handleRedo} canUndo={history.length>0} canRedo={redoStack.length>0} />
      {showCase && <BonusCase user={user} onClose={() => setShowCase(false)} onWin={updateBalance} />}
    </div>
  );
};

export default MainWall;
