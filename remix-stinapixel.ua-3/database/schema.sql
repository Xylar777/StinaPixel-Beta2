-- ====================================================================
-- STINAPIXEL.UA - Supabase & PostgreSQL Schema
-- Таблиця "pixels" (x, y, color, updated_at, payload, owner_uid)
-- ====================================================================
-- Для створення або перевірки таблиці в Supabase SQL Editor:
-- CREATE TABLE IF NOT EXISTS public.pixels (
--     x INT NOT NULL CHECK (x >= 0 AND x < 10000),
--     y INT NOT NULL CHECK (y >= 0 AND y < 10000),
--     color VARCHAR(7) NOT NULL,
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     payload JSONB DEFAULT '{}'::jsonb,
--     owner_uid TEXT NOT NULL,
--     PRIMARY KEY (x, y)
-- );
--
-- ALTER TABLE public.pixels ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Allow public read pixels" 
-- ON public.pixels FOR SELECT 
-- USING (true);
--
-- CREATE POLICY "Allow authenticated & anon insert pixels" 
-- ON public.pixels FOR INSERT 
-- WITH CHECK (true);
--
-- CREATE POLICY "Allow update pixels" 
-- ON public.pixels FOR UPDATE 
-- USING (true);
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- --------------------------------------------------------------------
-- 1. USERS & ROLES
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255),
    balance NUMERIC(12, 2) NOT NULL DEFAULT 10.00 CHECK (balance >= 0),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT,
    bio TEXT DEFAULT 'Привіт! Я бета-тестер спільного полотна StinaPixel.',
    telegram VARCHAR(64),
    instagram VARCHAR(64),
    twitch VARCHAR(64),
    referred_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    referral_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    referral_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);

-- --------------------------------------------------------------------
-- 2. PIXELS (The Shared Canvas)
-- --------------------------------------------------------------------
-- Note: x and y are bounded [0, 9999] for a 10,000 x 10,000 canvas.
-- Chunk size 64x64 creates 156x156 = ~24,400 chunks for lightning-fast spatial queries.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pixels (
    x INT NOT NULL CHECK (x >= 0 AND x < 10000),
    y INT NOT NULL CHECK (y >= 0 AND y < 10000),
    color VARCHAR(7) NOT NULL CHECK (color ~* '^#[0-9A-Fa-f]{6}$'),
    owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_name VARCHAR(64) NOT NULL,
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    art_id VARCHAR(128),
    description VARCHAR(255),
    link VARCHAR(512),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chunk_x INT GENERATED ALWAYS AS (x / 64) STORED,
    chunk_y INT GENERATED ALWAYS AS (y / 64) STORED,
    PRIMARY KEY (x, y)
);

-- Fast spatial indexes for viewport and chunk streaming
CREATE INDEX IF NOT EXISTS idx_pixels_chunk ON pixels(chunk_x, chunk_y);
CREATE INDEX IF NOT EXISTS idx_pixels_owner ON pixels(owner_id);
CREATE INDEX IF NOT EXISTS idx_pixels_art_id ON pixels(art_id) WHERE art_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pixels_updated_at ON pixels(updated_at DESC);

-- --------------------------------------------------------------------
-- 3. PIXEL AUDIT & ANTI-GRIEFING LOG (Safe Rollback Capability)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pixel_audit_log (
    id BIGSERIAL PRIMARY KEY,
    x INT NOT NULL,
    y INT NOT NULL,
    old_color VARCHAR(7),
    new_color VARCHAR(7) NOT NULL,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    art_id VARCHAR(128),
    cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_coords ON pixel_audit_log(x, y);
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON pixel_audit_log(user_id, created_at DESC);

-- --------------------------------------------------------------------
-- 4. PLAYER RATE LIMITING & COOLDOWNS (Anti-Bot / 100-Player Safety)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_cooldowns (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_pixel_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pixels_last_minute INT NOT NULL DEFAULT 0,
    minute_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_throttled BOOLEAN NOT NULL DEFAULT FALSE,
    throttled_until TIMESTAMPTZ
);

-- --------------------------------------------------------------------
-- 5. PUBLISHED ARTS (Museum / Gallery)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS published_arts (
    id VARCHAR(128) PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_name VARCHAR(64) NOT NULL,
    title VARCHAR(128) NOT NULL,
    description TEXT,
    link VARCHAR(512),
    pixel_count INT NOT NULL CHECK (pixel_count > 0),
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    center_x INT NOT NULL,
    center_y INT NOT NULL,
    likes_count INT NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arts_owner ON published_arts(owner_id);
CREATE INDEX IF NOT EXISTS idx_arts_created ON published_arts(created_at DESC);

-- Likes join table
CREATE TABLE IF NOT EXISTS art_likes (
    art_id VARCHAR(128) NOT NULL REFERENCES published_arts(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (art_id, user_id)
);

-- --------------------------------------------------------------------
-- 6. FINANCE & TRANSACTION LOGS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_logs (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id VARCHAR(64),
    amount NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    action_type VARCHAR(64) NOT NULL, -- 'DRAW_PIXELS', 'BUY_VIP', 'BONUS_CASE', 'ADMIN_ADJUST', 'REFERRAL_REWARD'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_user ON finance_logs(user_id, created_at DESC);

-- --------------------------------------------------------------------
-- 7. CHAT MESSAGES
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(128) PRIMARY KEY,
    from_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(from_id, to_id, created_at DESC);

-- --------------------------------------------------------------------
-- 8. PROMO CODES
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
    code VARCHAR(32) PRIMARY KEY,
    reward NUMERIC(10, 2) NOT NULL CHECK (reward > 0),
    max_uses INT NOT NULL DEFAULT 100,
    used_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
    code VARCHAR(32) NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (code, user_id)
);

-- ====================================================================
-- ATOMIC STORED PROCEDURES (SECURITY & INTEGRITY)
-- ====================================================================

-- --------------------------------------------------------------------
-- Procedure: place_pixel_batch_safe
-- Atomically validates user balance, checks VIP permissions,
-- debits balance, upserts pixels, and writes to audit log.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION place_pixel_batch_safe(
    p_user_id VARCHAR(64),
    p_pixels_json JSONB, -- Array of objects: [{"x": 10, "y": 20, "color": "#FF0000"}]
    p_is_vip BOOLEAN,
    p_cost_per_pixel NUMERIC(10, 2),
    p_art_id VARCHAR(128) DEFAULT NULL,
    p_description VARCHAR(255) DEFAULT NULL,
    p_link VARCHAR(512) DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    placed_count INT,
    new_balance NUMERIC(12, 2),
    error_message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user users%ROWTYPE;
    v_total_pixels INT;
    v_total_cost NUMERIC(12, 2);
    v_item JSONB;
    v_x INT;
    v_y INT;
    v_color VARCHAR(7);
    v_existing_pixel pixels%ROWTYPE;
    v_placed INT := 0;
BEGIN
    -- 1. Fetch user with row lock to avoid race conditions
    SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0.00::NUMERIC(12, 2), 'Користувача не знайдено'::TEXT;
        RETURN;
    END IF;

    IF v_user.is_banned THEN
        RETURN QUERY SELECT FALSE, 0, v_user.balance, 'Користувач заблокований адміністратором'::TEXT;
        RETURN;
    END IF;

    v_total_pixels := jsonb_array_length(p_pixels_json);
    IF v_total_pixels = 0 THEN
        RETURN QUERY SELECT TRUE, 0, v_user.balance, NULL::TEXT;
        RETURN;
    END IF;

    -- Anti-spam / Batch limit for 100 players
    IF v_total_pixels > 5000 AND NOT v_user.is_admin THEN
        RETURN QUERY SELECT FALSE, 0, v_user.balance, 'Перевищено максимальний розмір одного малюнка (5,000 пікселів)'::TEXT;
        RETURN;
    END IF;

    v_total_cost := v_total_pixels * p_cost_per_pixel;

    -- Check balance (admins draw free)
    IF NOT v_user.is_admin AND v_user.balance < v_total_cost THEN
        RETURN QUERY SELECT FALSE, 0, v_user.balance, 'Недостатній баланс для розміщення пікселів'::TEXT;
        RETURN;
    END IF;

    -- 2. Validate & Upsert each pixel
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_pixels_json)
    LOOP
        v_x := (v_item->>'x')::INT;
        v_y := (v_item->>'y')::INT;
        v_color := v_item->>'color';

        -- Bounds check
        IF v_x < 0 OR v_x >= 10000 OR v_y < 0 OR v_y >= 10000 THEN
            CONTINUE;
        END IF;

        -- Check VIP protection
        SELECT * INTO v_existing_pixel FROM pixels WHERE x = v_x AND y = v_y;
        IF FOUND AND v_existing_pixel.is_vip AND NOT v_user.is_admin AND v_existing_pixel.owner_id != p_user_id THEN
            -- VIP pixel cannot be overwritten by normal drawing
            IF NOT p_is_vip THEN
                CONTINUE; -- Skip protected VIP pixel
            END IF;
        END IF;

        -- Record Audit Log for safe anti-vandalism rollback
        INSERT INTO pixel_audit_log (x, y, old_color, new_color, user_id, is_vip, art_id, cost, created_at)
        VALUES (v_x, v_y, v_existing_pixel.color, v_color, p_user_id, p_is_vip, p_art_id, p_cost_per_pixel, NOW());

        -- Upsert Pixel
        INSERT INTO pixels (x, y, color, owner_id, owner_name, is_vip, art_id, description, link, updated_at)
        VALUES (v_x, v_y, v_color, p_user_id, v_user.username, p_is_vip, p_art_id, p_description, p_link, NOW())
        ON CONFLICT (x, y) DO UPDATE SET
            color = EXCLUDED.color,
            owner_id = EXCLUDED.owner_id,
            owner_name = EXCLUDED.owner_name,
            is_vip = EXCLUDED.is_vip,
            art_id = EXCLUDED.art_id,
            description = EXCLUDED.description,
            link = EXCLUDED.link,
            updated_at = NOW();

        v_placed := v_placed + 1;
    END LOOP;

    -- 3. Deduct actual placed cost from user balance
    IF NOT v_user.is_admin AND v_placed > 0 THEN
        v_total_cost := v_placed * p_cost_per_pixel;
        UPDATE users 
        SET balance = balance - v_total_cost,
            last_active = NOW()
        WHERE id = p_user_id
        RETURNING balance INTO v_user.balance;

        -- Log finance entry
        INSERT INTO finance_logs (id, user_id, amount, balance_after, action_type, description, created_at)
        VALUES (
            'FIN_DRAW_' || extract(epoch from now())::BIGINT || '_' || floor(random()*10000),
            p_user_id,
            -v_total_cost,
            v_user.balance,
            CASE WHEN p_is_vip THEN 'BUY_VIP' ELSE 'DRAW_PIXELS' END,
            'Розміщення ' || v_placed || ' пікселів на спільному полотні',
            NOW()
        );
    ELSE
        UPDATE users SET last_active = NOW() WHERE id = p_user_id;
    END IF;

    RETURN QUERY SELECT TRUE, v_placed, v_user.balance, NULL::TEXT;
END;
$$;

-- --------------------------------------------------------------------
-- Procedure: rollback_user_vandalism
-- Admin tool to instantly revert all vandalism by a griefer/bot
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rollback_user_vandalism(
    p_admin_id VARCHAR(64),
    p_target_user_id VARCHAR(64),
    p_since_timestamp TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS TABLE (
    reverted_count INT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin users%ROWTYPE;
    v_log RECORD;
    v_count INT := 0;
BEGIN
    SELECT * INTO v_admin FROM users WHERE id = p_admin_id;
    IF NOT FOUND OR NOT v_admin.is_admin THEN
        RETURN QUERY SELECT 0, 'Доступ заборонено: потрібні права адміністратора'::TEXT;
        RETURN;
    END IF;

    -- Loop through all audit logs for this user since the timestamp in reverse order
    FOR v_log IN 
        SELECT x, y, old_color 
        FROM pixel_audit_log 
        WHERE user_id = p_target_user_id AND created_at >= p_since_timestamp
        ORDER BY id DESC
    LOOP
        IF v_log.old_color IS NOT NULL THEN
            UPDATE pixels SET color = v_log.old_color, updated_at = NOW() WHERE x = v_log.x AND y = v_log.y;
        ELSE
            DELETE FROM pixels WHERE x = v_log.x AND y = v_log.y;
        END IF;
        v_count := v_count + 1;
    END LOOP;

    -- Ban the malicious user
    UPDATE users SET is_banned = TRUE WHERE id = p_target_user_id;

    RETURN QUERY SELECT v_count, ('Успішно відкочено ' || v_count || ' дій та заблоковано користувача ' || p_target_user_id)::TEXT;
END;
$$;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixels ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixel_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_arts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Pixels: Anyone can read, writes must pass through safe procedures or auth
DROP POLICY IF EXISTS p_pixels_read ON pixels;
CREATE POLICY p_pixels_read ON pixels FOR SELECT USING (true);

-- Arts: Anyone can read
DROP POLICY IF EXISTS p_arts_read ON published_arts;
CREATE POLICY p_arts_read ON published_arts FOR SELECT USING (true);

-- Users: Anyone can view public profile, self can view balance
DROP POLICY IF EXISTS p_users_read ON users;
CREATE POLICY p_users_read ON users FOR SELECT USING (true);

-- ====================================================================
-- SEED DATA FOR BETA (Admin and initial configuration)
-- ====================================================================
INSERT INTO users (id, email, username, balance, is_admin, bio)
VALUES 
    ('ID000000', 'bravlsmars2000@gmail.com', 'Admin', 1000000.00, TRUE, 'Головний адміністратор та розробник полотна StinaPixel.ua')
ON CONFLICT (id) DO UPDATE SET 
    is_admin = TRUE,
    balance = 1000000.00;

-- Initial welcome banner promo code
INSERT INTO promo_codes (code, reward, max_uses, is_active)
VALUES 
    ('BETA100', 50.00, 100, TRUE),
    ('STINA2026', 25.00, 500, TRUE)
ON CONFLICT (code) DO NOTHING;
