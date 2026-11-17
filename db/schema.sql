-- Schema do Postgres (Neon) usado pelo app web.
-- Idempotente: pode ser executado várias vezes.

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relatórios de IA gerados pelo daily_stock_analysis (tabela analysis_history do SQLite).
CREATE TABLE IF NOT EXISTS analyses (
    id               BIGSERIAL PRIMARY KEY,
    query_id         TEXT,
    code             TEXT NOT NULL,
    name             TEXT,
    report_type      TEXT,
    sentiment_score  INTEGER,
    operation_advice TEXT,
    trend_prediction TEXT,
    analysis_summary TEXT,
    raw_result       JSONB,
    news_content     TEXT,
    ideal_buy        DOUBLE PRECISION,
    secondary_buy    DOUBLE PRECISION,
    stop_loss        DOUBLE PRECISION,
    take_profit      DOUBLE PRECISION,
    created_at       TIMESTAMPTZ NOT NULL,
    synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (code, created_at)
);
CREATE INDEX IF NOT EXISTS ix_analyses_code_time ON analyses (code, created_at DESC);

-- Cotações diárias + indicadores (tabela stock_daily do SQLite).
CREATE TABLE IF NOT EXISTS stock_daily (
    code         TEXT NOT NULL,
    date         DATE NOT NULL,
    open         DOUBLE PRECISION,
    high         DOUBLE PRECISION,
    low          DOUBLE PRECISION,
    close        DOUBLE PRECISION,
    volume       DOUBLE PRECISION,
    amount       DOUBLE PRECISION,
    pct_chg      DOUBLE PRECISION,
    ma5          DOUBLE PRECISION,
    ma10         DOUBLE PRECISION,
    ma20         DOUBLE PRECISION,
    volume_ratio DOUBLE PRECISION,
    data_source  TEXT,
    PRIMARY KEY (code, date)
);

-- Screener de swing trade da B3 (b3/swing_screener.py).
CREATE TABLE IF NOT EXISTS swing_runs (
    id            BIGSERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    universe_size INTEGER,
    screened      INTEGER,
    ibov_chg20    DOUBLE PRECISION,
    ibov_trend    TEXT,
    params        JSONB
);

CREATE TABLE IF NOT EXISTS swing_picks (
    id          BIGSERIAL PRIMARY KEY,
    run_id      BIGINT NOT NULL REFERENCES swing_runs(id) ON DELETE CASCADE,
    rank        INTEGER NOT NULL,
    code        TEXT NOT NULL,
    name        TEXT,
    setup       TEXT,
    score       INTEGER,
    price       DOUBLE PRECISION,
    entry       DOUBLE PRECISION,
    stop        DOUBLE PRECISION,
    target      DOUBLE PRECISION,
    target2     DOUBLE PRECISION,
    risk_pct    DOUBLE PRECISION,
    reward_pct  DOUBLE PRECISION,
    rsi         DOUBLE PRECISION,
    atr_pct     DOUBLE PRECISION,
    fin_volume  DOUBLE PRECISION,
    rs20        DOUBLE PRECISION,
    selected    BOOLEAN NOT NULL DEFAULT false,
    metrics     JSONB,
    ai          JSONB
);
CREATE INDEX IF NOT EXISTS ix_swing_picks_run ON swing_picks (run_id, rank);
