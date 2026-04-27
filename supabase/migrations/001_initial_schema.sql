CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin VARCHAR(3) NOT NULL,
    destination VARCHAR(3) NOT NULL,
    label VARCHAR(100),
    enabled BOOLEAN DEFAULT TRUE,
    flexible_days INTEGER DEFAULT 0,
    target_months INTEGER[] DEFAULT NULL,
    absolute_threshold NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE price_snapshots (
    id BIGSERIAL PRIMARY KEY,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    search_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE,
    price_usd NUMERIC NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    airline VARCHAR(100),
    stops INTEGER DEFAULT 0,
    duration_minutes INTEGER,
    booking_link TEXT,
    raw_data JSONB,
    source VARCHAR(20) NOT NULL,
    is_separate_tickets BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_route_dep ON price_snapshots(route_id, departure_date);
CREATE INDEX idx_snapshots_search_date ON price_snapshots(search_date DESC);

CREATE TABLE multi_stop_combos (
    id BIGSERIAL PRIMARY KEY,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    search_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    hub VARCHAR(3) NOT NULL,
    leg1_price NUMERIC NOT NULL,
    leg2_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    direct_price NUMERIC,
    savings_pct NUMERIC,
    layover_hours NUMERIC,
    leg1_airline VARCHAR(100),
    leg2_airline VARCHAR(100),
    warnings TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    snapshot_id BIGINT REFERENCES price_snapshots(id),
    combo_id BIGINT REFERENCES multi_stop_combos(id),
    alert_type VARCHAR(20) NOT NULL,
    triggered_price NUMERIC NOT NULL,
    baseline_p25 NUMERIC,
    discount_pct NUMERIC,
    severity VARCHAR(10) DEFAULT 'medium',
    is_dismissed BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_active ON alerts(created_at DESC)
    WHERE is_dismissed = FALSE AND is_archived = FALSE;

CREATE VIEW route_summary AS
SELECT
    r.id, r.origin, r.destination, r.label, r.enabled,
    COUNT(DISTINCT ps.id) AS snapshot_count,
    MIN(ps.price_usd) AS min_price_ever,
    MAX(ps.price_usd) AS max_price_ever,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ps.price_usd) AS p25_overall,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ps.price_usd) AS median,
    (SELECT price_usd FROM price_snapshots
     WHERE route_id = r.id ORDER BY search_date DESC, price_usd ASC LIMIT 1) AS latest_price,
    MAX(ps.search_date) AS last_searched
FROM routes r
LEFT JOIN price_snapshots ps ON ps.route_id = r.id
GROUP BY r.id;

INSERT INTO routes (origin, destination, label, absolute_threshold) VALUES
    ('LIM', 'MAD', 'Lima → Madrid',       650),
    ('LIM', 'COR', 'Lima → Córdoba',      300),
    ('LIM', 'AUA', 'Lima → Aruba',        400),
    ('LIM', 'MIA', 'Lima → Miami',        280),
    ('LIM', 'EZE', 'Lima → Buenos Aires', 250);
