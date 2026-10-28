import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PixelData } from '../types';

// Read environment variables (supports client Vite import.meta.env and Node process.env)
const getEnvVar = (name: string): string => {
  const meta = import.meta as any;
  if (meta && meta.env && meta.env[name]) {
    return meta.env[name];
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name] as string;
  }
  return '';
};

export const SUPABASE_URL = 
  getEnvVar('VITE_SUPABASE_URL') || 
  getEnvVar('SUPABASE_URL');

export const SUPABASE_ANON_KEY = 
  getEnvVar('VITE_SUPABASE_ANON_KEY') || 
  getEnvVar('SUPABASE_ANON_KEY');

export const isSupabaseConfigured = (): boolean => {
  return !!(
    SUPABASE_URL && 
    SUPABASE_ANON_KEY && 
    SUPABASE_URL.startsWith('http') &&
    !SUPABASE_URL.includes('xyzcompany')
  );
};

export interface SupabasePixelRow {
  x: number;
  y: number;
  color: string;
  updated_at: string;
  payload: {
    artId?: string;
    title?: string;
    link?: string;
    isVIP: boolean;
    ownerName?: string;
  } | null;
  owner_uid: string;
}

// Lazy client initialization to prevent crash if env vars are empty
let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;
  if (!isSupabaseConfigured()) return null;

  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return supabaseInstance;
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client:', err);
    return null;
  }
};

/**
 * Ensures user has an active session in Supabase (Anonymous Auth if not signed in)
 * This guarantees a valid UUID for owner_uid satisfying RLS policies.
 */
export const ensureSupabaseAuth = async (): Promise<string | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }

    // Attempt anonymous sign in
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn('[Supabase Auth] Anonymous sign in failed (check if enabled in dashboard):', error.message);
      return null;
    }
    return data.user?.id || null;
  } catch (err) {
    console.warn('[Supabase Auth] Session error:', err);
    return null;
  }
};

/**
 * Fetches all pixels from the Supabase "pixels" table
 */
export const fetchPixelsFromSupabase = async (): Promise<Map<string, PixelData>> => {
  const map = new Map<string, PixelData>();
  const supabase = getSupabaseClient();
  if (!supabase) return map;

  try {
    const { data, error } = await supabase
      .from('pixels')
      .select('x, y, color, updated_at, payload, owner_uid')
      .limit(50000);

    if (error) {
      console.error('[Supabase] Error loading pixels:', error.message);
      return map;
    }

    if (data && Array.isArray(data)) {
      for (const row of (data as SupabasePixelRow[])) {
        const key = `${row.x},${row.y}`;
        const payload = row.payload || { isVIP: false };
        map.set(key, {
          color: row.color,
          ownerId: row.owner_uid || 'unknown',
          ownerName: payload.ownerName || 'User',
          isVIP: !!payload.isVIP,
          timestamp: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
          artId: payload.artId,
          description: payload.title,
          link: payload.link
        });
      }
    }
  } catch (err) {
    console.error('[Supabase] Fetch error:', err);
  }

  return map;
};

/**
 * Batch saves pixels directly to Supabase "pixels" table
 * Matches exact schema: x, y, color, updated_at, payload, owner_uid
 */
export const savePixelsToSupabase = async (
  user: any,
  pixels: { x: number; y: number; color: string }[],
  mode: string,
  artId?: string,
  title?: string,
  link?: string
): Promise<{ success: boolean; placedCount: number; error?: string }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      placedCount: 0,
      error: 'Supabase не налаштовано. Додайте VITE_SUPABASE_URL та VITE_SUPABASE_ANON_KEY у змінні середовища.'
    };
  }

  try {
    // 1. Get or create auth UID for owner_uid column
    let authUid = await ensureSupabaseAuth();
    if (!authUid) {
      // Fallback to user.id if anonymous auth isn't enabled yet in Supabase
      authUid = user?.id || 'anon_player';
    }

    const isVIP = mode === 'VIP';
    const nowIso = new Date().toISOString();

    // 2. Prepare payload exactly matching the user's Supabase pixels table schema
    const rows: SupabasePixelRow[] = pixels.map(p => ({
      x: p.x,
      y: p.y,
      color: p.color,
      updated_at: nowIso,
      payload: {
        artId: artId || undefined,
        title: title || undefined,
        link: link || undefined,
        isVIP,
        ownerName: user?.username || 'Гравець'
      },
      owner_uid: authUid as string
    }));

    // 3. Upsert into Supabase "pixels" table
    // Batch in chunks of 1000 for stability with large artworks
    const CHUNK_SIZE = 1000;
    let placed = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('pixels')
        .upsert(chunk, { onConflict: 'x,y' });

      if (error) {
        console.error('[Supabase Upsert Error]:', error);
        return {
          success: false,
          placedCount: placed,
          error: `Помилка Supabase: ${error.message} (код: ${error.code || 'RLS_OR_SCHEMA'})`
        };
      }
      placed += chunk.length;
    }

    return {
      success: true,
      placedCount: placed
    };
  } catch (err: any) {
    console.error('[Supabase Save Error]:', err);
    return {
      success: false,
      placedCount: 0,
      error: `Помилка з'єднання з Supabase: ${err.message || 'Невідома помилка'}`
    };
  }
};

/**
 * Subscribes to Supabase Realtime changes on table "pixels"
 */
export const subscribeToSupabaseRealtime = (
  onPixelChange: (pixel: { key: string; data: PixelData }) => void
): (() => void) => {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  try {
    const channel = supabase
      .channel('public:pixels')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pixels' },
        (payload: any) => {
          const newRow = payload.new as SupabasePixelRow;
          if (newRow && typeof newRow.x === 'number' && typeof newRow.y === 'number') {
            const key = `${newRow.x},${newRow.y}`;
            const meta = newRow.payload || { isVIP: false };
            onPixelChange({
              key,
              data: {
                color: newRow.color,
                ownerId: newRow.owner_uid || 'unknown',
                ownerName: meta.ownerName || 'User',
                isVIP: !!meta.isVIP,
                timestamp: newRow.updated_at ? new Date(newRow.updated_at).getTime() : Date.now(),
                artId: meta.artId,
                description: meta.title,
                link: meta.link
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[Supabase Realtime] Subscribe error:', err);
    return () => {};
  }
};
