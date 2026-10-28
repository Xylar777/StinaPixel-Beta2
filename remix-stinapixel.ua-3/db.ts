
import { PixelData } from './types';

const DB_NAME = 'StinaPixelDB';
const DB_VERSION = 1;
const STORE_CANVAS = 'global_canvas';
const STORE_ART_PIXELS = 'art_pixels';

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_CANVAS)) {
        db.createObjectStore(STORE_CANVAS);
      }
      if (!db.objectStoreNames.contains(STORE_ART_PIXELS)) {
        db.createObjectStore(STORE_ART_PIXELS);
      }
    };
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onerror = () => {
      dbInstance = null;
      reject(request.error);
    };
  });
};

export const saveCanvasPixelsDB = async (pixels: [string, PixelData][]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CANVAS, 'readwrite');
    const store = transaction.objectStore(STORE_CANVAS);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    for (const [coord, data] of pixels) {
      store.put(data, coord);
    }
  });
};

export const deleteCanvasPixelsDB = async (keys: string[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CANVAS, 'readwrite');
    const store = transaction.objectStore(STORE_CANVAS);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    for (const key of keys) {
      store.delete(key);
    }
  });
};

import { isSupabaseConfigured, fetchPixelsFromSupabase, savePixelsToSupabase } from './utils/supabase';

export const getCanvasPixelsDB = async (): Promise<Map<string, PixelData>> => {
  const map = new Map<string, PixelData>();
  
  // 1. Load from local IndexedDB first for instant UI response
  try {
    const db = await initDB();
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE_CANVAS, 'readonly');
      const store = transaction.objectStore(STORE_CANVAS);
      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          map.set(cursor.key as string, cursor.value as PixelData);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('Local DB load warning:', err);
  }

  // 2. Fetch authoritative state from Supabase "pixels" table if configured
  if (isSupabaseConfigured()) {
    try {
      const supabasePixels = await fetchPixelsFromSupabase();
      if (supabasePixels.size > 0) {
        const dbUpdates: [string, PixelData][] = [];
        supabasePixels.forEach((val, key) => {
          map.set(key, val);
          dbUpdates.push([key, val]);
        });
        // Cache to IndexedDB
        saveCanvasPixelsDB(dbUpdates).catch(() => {});
        return map;
      }
    } catch (err) {
      console.warn('[Supabase Sync Warning]:', err);
    }
  }

  // 3. Fallback: Fetch from local server API if Supabase is not configured
  try {
    const res = await fetch('/api/canvas/pixels');
    if (res.ok) {
      const data = await res.json();
      if (data && data.pixels) {
        const dbUpdates: [string, PixelData][] = [];
        for (const [key, p] of Object.entries<any>(data.pixels)) {
          const pixelData: PixelData = {
            color: p.color,
            ownerId: p.ownerId,
            ownerName: p.ownerName,
            isVIP: p.isVIP,
            timestamp: p.timestamp,
            artId: p.artId,
            description: p.description,
            link: p.link
          };
          map.set(key, pixelData);
          dbUpdates.push([key, pixelData]);
        }
        if (dbUpdates.length > 0) {
          saveCanvasPixelsDB(dbUpdates).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.log('[Client DB] Using local offline cache:', err);
  }

  return map;
};

export const saveCanvasBatchServer = async (
  user: any,
  pixels: { x: number; y: number; color: string }[],
  mode: string,
  artId?: string,
  title?: string,
  link?: string
): Promise<{ success: boolean; placedCount: number; newBalance?: number; error?: string }> => {
  // If Supabase is configured, save directly to the Supabase "pixels" table
  if (isSupabaseConfigured()) {
    const supabaseResult = await savePixelsToSupabase(user, pixels, mode, artId, title, link);
    if (!supabaseResult.success) {
      return {
        success: false,
        placedCount: 0,
        error: supabaseResult.error || 'Помилка збереження в Supabase'
      };
    }

    // Notify local server / websocket for live broadcast
    fetch('/api/canvas/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pixels, mode, artId, title, link })
    }).catch(() => {});

    const costPerPx = mode === 'VIP' ? 0.25 : 0.10;
    return {
      success: true,
      placedCount: supabaseResult.placedCount,
      newBalance: user.isAdmin ? user.balance : user.balance - (supabaseResult.placedCount * costPerPx)
    };
  }

  // Fallback to local server if Supabase is not yet configured
  try {
    const res = await fetch('/api/canvas/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user,
        pixels,
        mode,
        artId,
        title,
        link
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { 
        success: false, 
        placedCount: 0, 
        error: err.error || 'Помилка збереження на сервері (перевірте баланс або ліміт)' 
      };
    }
    const data = await res.json();
    return data;
  } catch (e: any) {
    console.warn('[Server Batch] Fallback to local mode:', e);
    // Offline local fallback
    return { success: true, placedCount: pixels.length };
  }
};

export const saveArtPixelsDB = async (artId: string, pixels: { [key: string]: string }): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_ART_PIXELS, 'readwrite');
    const store = transaction.objectStore(STORE_ART_PIXELS);
    const request = store.put(pixels, artId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getArtPixelsDB = async (artId: string): Promise<{ [key: string]: string } | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_ART_PIXELS, 'readonly');
    const store = transaction.objectStore(STORE_ART_PIXELS);
    const request = store.get(artId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

