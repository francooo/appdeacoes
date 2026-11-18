"""Screener de swing trade da B3: varredura quantitativa + validação com IA.

1. Baixa ~1 ano de cotações de um universo de ações líquidas (Yahoo Finance, .SA).
2. Pontua cada ação por tendência, momento, força relativa vs Ibovespa e setup
   (rompimento com volume ou pullback na MM20), com filtro de liquidez.
3. Monta o plano: entrada, stop (fundo de 10 dias / 2×ATR) e alvos 2R e 3R.
4. As melhores (SWING_TOP_N) são avaliadas pela IA (Groq) com notícias recentes.
5. Grava a rodada em swing_runs / swing_picks no Postgres.

Uso:
    GROQ_API_KEY=... DATABASE_URL=... python b3/swing_screener.py
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
from pathlib import Path

import pandas as pd
import psycopg
import yfinance as yf
from openai import APIStatusError, OpenAI, RateLimitError

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_FILE = ROOT / "db" / "schema.sql"

# Universo: componentes do Ibovespa + algumas small/mid caps líquidas.
# Tickers inválidos/deslistados são ignorados automaticamente.
DEFAULT_UNIVERSE = """
ABEV3 ALOS3 ALUP11 ASAI3 AUAU3 AURE3 AXIA3 AZZA3 B3SA3 BBAS3 BBDC3 BBDC4 BBSE3 BEEF3 BPAC11
BRAP4 BRAV3 BRKM5 CMIG4 CMIN3 COGN3 CPFE3 CPLE3 CSAN3 CSMG3 CSNA3 CURY3 CVCB3 CXSE3 CYRE3
DIRR3 DXCO3 EGIE3 EMBJ3 ENEV3 ENGI11 EQTL3 EZTC3 FLRY3 GGBR4 GMAT3 GOAU4 HAPV3 HYPE3
IGTI11 INTB3 IRBR3 ISAE4 ITSA4 ITUB4 KLBN11 LREN3 LWSA3 MBRF3 MGLU3 MOTV3 MRVE3 MULT3
NATU3 PCAR3 PETR3 PETR4 POMO4 PRIO3 PSSA3 RADL3 RAIL3 RAIZ4 RDOR3 RECV3
RENT3 SANB11 SAPR11 SBSP3 SLCE3 SMFT3 SMTO3 SUZB3 TAEE11 TIMS3 TOTS3 UGPA3 USIM5
VALE3 VAMO3 VBBR3 VIVA3 VIVT3 WEGE3 YDUQ3
"""

MIN_FIN_VOLUME = float(os.environ.get("SWING_MIN_FIN_VOLUME", 20e6))  # R$ médio/dia (20d)
TOP_N = int(os.environ.get("SWING_TOP_N", 8))
KEEP = 30  # quantas do ranking guardar
MIN_SCORE_FOR_AI = int(os.environ.get("SWING_MIN_SCORE", 55))
MODELS = [m.strip() for m in os.environ.get(
    "GROQ_MODELS", "openai/gpt-oss-120b,openai/gpt-oss-20b").split(",") if m.strip()]
PAUSE_SECONDS = float(os.environ.get("SWING_PAUSE_SECONDS", 15))


def _num(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def _r(v, nd=2):
    v = _num(v)
    return None if v is None else round(v, nd)


# ----------------------------------------------------------------------------- dados

def download(codes: list[str]) -> tuple[dict[str, pd.DataFrame], pd.Series | None]:
    tickers = [f"{c}.SA" for c in codes] + ["^BVSP"]
    raw = yf.download(tickers, period="1y", interval="1d", group_by="ticker",
                      auto_adjust=True, threads=True, progress=False)
    frames: dict[str, pd.DataFrame] = {}
    for c in codes:
        try:
            df = raw[f"{c}.SA"].dropna(subset=["Close"])
        except KeyError:
            continue
        if len(df) >= 120:
            frames[c] = df
    ibov = None
    try:
        ibov = raw["^BVSP"]["Close"].dropna()
    except KeyError:
        pass
    return frames, ibov


# ----------------------------------------------------------------------------- análise

def evaluate(code: str, df: pd.DataFrame, ibov: pd.Series | None) -> dict | None:
    close, high, low, vol = df["Close"], df["High"], df["Low"], df["Volume"]
    price = close.iloc[-1]

    fin_vol = (close * vol).tail(20).mean()
    if not fin_vol or fin_vol < MIN_FIN_VOLUME:
        return None

    ma20, ma50 = close.rolling(20).mean(), close.rolling(50).mean()
    ma200 = close.rolling(200).mean() if len(close) >= 200 else None
    ema9 = close.ewm(span=9, adjust=False).mean()

    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean()
    rsi = (100 - 100 / (1 + gain / loss.replace(0, float("nan")))).iloc[-1]

    macd = close.ewm(span=12, adjust=False).mean() - close.ewm(span=26, adjust=False).mean()
    hist = macd - macd.ewm(span=9, adjust=False).mean()

    tr = pd.concat([high - low, (high - close.shift()).abs(), (low - close.shift()).abs()], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1 / 14, adjust=False).mean().iloc[-1]

    vol_ratio = vol.iloc[-1] / vol.iloc[-21:-1].mean() if vol.iloc[-21:-1].mean() else 1.0
    prior_high20 = high.iloc[-21:-1].max()
    low10 = low.tail(10).min()
    ret20 = price / close.iloc[-21] - 1
    ret60 = price / close.iloc[-61] - 1
    m20, m50 = ma20.iloc[-1], ma50.iloc[-1]
    m200 = ma200.iloc[-1] if ma200 is not None else None
    ma50_slope = m50 / ma50.iloc[-11] - 1
    dist_ma20 = price / m20 - 1

    rs20 = rs60 = None
    if ibov is not None and len(ibov) > 61:
        rs20 = ret20 - (ibov.iloc[-1] / ibov.iloc[-21] - 1)
        rs60 = ret60 - (ibov.iloc[-1] / ibov.iloc[-61] - 1)

    # ---------------- pontuação (0–100)
    score = 0.0
    reasons, warnings = [], []

    # Tendência (30)
    if price > m50:
        score += 10; reasons.append("Preço acima da MM50")
    if m20 > m50:
        score += 10; reasons.append("MM20 acima da MM50")
    if ma50_slope > 0:
        score += 5; reasons.append("MM50 inclinada para cima")
    if m200 is not None and price > m200:
        score += 5; reasons.append("Acima da MM200 (tendência primária de alta)")

    # Momento (20)
    if 50 <= rsi <= 68:
        score += 20; reasons.append(f"RSI {rsi:.0f}: momento positivo sem sobrecompra")
    elif 45 <= rsi < 50 or 68 < rsi <= 72:
        score += 10
    if rsi > 75:
        score -= 15; warnings.append(f"RSI {rsi:.0f}: sobrecomprado")

    # MACD (10)
    if hist.iloc[-1] > 0 and hist.iloc[-1] > hist.iloc[-2]:
        score += 10; reasons.append("MACD positivo e acelerando")
    elif hist.iloc[-1] > hist.iloc[-2]:
        score += 5; reasons.append("MACD virando para cima")

    # Força relativa (20)
    if rs20 is not None:
        score += max(0.0, min(10.0, rs20 * 100))  # +1 ponto por p.p. acima do Ibovespa
        score += 10 if (rs60 or 0) > 0 else 0
        if rs20 > 0:
            reasons.append(f"Mais forte que o Ibovespa em 20 dias (+{rs20 * 100:.1f} p.p.)")

    # Setup (20)
    uptrend = price > m50 and m20 > m50
    touched_ma20 = (low.tail(3) <= ma20.tail(3) * 1.01).any()
    if price > prior_high20 and vol_ratio >= 1.3:
        setup = "Rompimento com volume"
        score += 20; reasons.append(f"Rompeu a máxima de 20 dias com volume {vol_ratio:.1f}x a média")
    elif uptrend and -0.01 <= dist_ma20 <= 0.03 and touched_ma20:
        setup = "Pullback na MM20"
        score += 20; reasons.append("Correção até a MM20 dentro de tendência de alta")
    elif uptrend and price > ema9.iloc[-1]:
        setup = "Tendência de alta"
        score += 8
    else:
        setup = "Sem setup"

    if dist_ma20 > 0.08:
        score -= 15; warnings.append(f"Esticado {dist_ma20 * 100:.1f}% acima da MM20")

    # ---------------- plano de trade
    stop = max(low10, price - 2 * atr)
    if (price - stop) / price < 0.015:
        stop = price - 1.5 * atr
    risk = price - stop
    target, target2 = price + 2 * risk, price + 3 * risk
    risk_pct = risk / price * 100
    if risk_pct > 8:
        warnings.append(f"Stop distante ({risk_pct:.1f}%): reduza o tamanho da posição")

    return {
        "code": code,
        "score": int(max(0, min(100, round(score)))),
        "setup": setup,
        "price": price, "entry": price, "stop": stop, "target": target, "target2": target2,
        "risk_pct": risk_pct, "reward_pct": (target / price - 1) * 100,
        "rsi": rsi, "atr_pct": atr / price * 100, "fin_volume": fin_vol,
        "rs20": None if rs20 is None else rs20 * 100,
        "metrics": {
            "ma20": _r(m20), "ma50": _r(m50), "ma200": _r(m200), "ema9": _r(ema9.iloc[-1]),
            "dist_ma20_pct": _r(dist_ma20 * 100), "ma50_slope_pct": _r(ma50_slope * 100),
            "macd_hist": _r(hist.iloc[-1], 3), "vol_ratio": _r(vol_ratio),
            "prior_high20": _r(prior_high20), "low10": _r(low10), "atr": _r(atr),
            "ret5_pct": _r((price / close.iloc[-6] - 1) * 100), "ret20_pct": _r(ret20 * 100),
            "ret60_pct": _r(ret60 * 100), "rs60_pp": _r(None if rs60 is None else rs60 * 100),
            "high_52w": _r(high.max()), "low_52w": _r(low.min()),
            "date": df.index[-1].date().isoformat(),
            "reasons": reasons, "warnings": warnings,
        },
    }


# ----------------------------------------------------------------------------- IA

SYSTEM = """Você é um trader de swing trade na B3 (operações de 3 a 20 pregões).
Avalie o setup técnico fornecido com rigor e conservadorismo. Use SOMENTE os dados fornecidos;
não invente números nem notícias. Responda em português do Brasil, APENAS com JSON válido:
{
  "veredito": "Operar" | "Aguardar" | "Evitar",
  "confianca": "Alta" | "Média" | "Baixa",
  "tese": 2-3 frases explicando o porquê,
  "gatilho_entrada": condição objetiva para entrar (ex.: "fechamento acima de R$ X com volume"),
  "gestao": como conduzir (stop móvel, parcial no alvo 1 etc.),
  "horizonte": ex. "5 a 15 pregões",
  "riscos": [2-4 riscos],
  "checklist": ["✅/⚠️/❌ item", 4-6 itens]
}"""


def news_for(code: str) -> list[str]:
    try:
        out = []
        for item in (yf.Ticker(f"{code}.SA").news or [])[:4]:
            c = item.get("content", item)
            if c.get("title"):
                out.append(f"[{(c.get('pubDate') or '')[:10]}] {c['title']}")
        return out
    except Exception:  # noqa: BLE001
        return []


def ai_review(client: OpenAI, pick: dict, name: str, ibov_trend: str) -> dict | None:
    m = pick["metrics"]
    news = news_for(pick["code"])
    prompt = "\n".join([
        f"Ação {pick['code']} ({name}), B3, dados até {m['date']}. Ibovespa: {ibov_trend}.",
        f"Setup detectado: {pick['setup']} | nota quantitativa {pick['score']}/100",
        f"Preço R$ {pick['price']:.2f} | MM20 {m['ma20']} | MM50 {m['ma50']} | MM200 {m['ma200']} | distância da MM20 {m['dist_ma20_pct']}%",
        f"RSI14 {pick['rsi']:.1f} | histograma MACD {m['macd_hist']} | volume {m['vol_ratio']}x a média 20d | ATR {pick['atr_pct']:.1f}% do preço",
        f"Retornos: 5d {m['ret5_pct']}% | 20d {m['ret20_pct']}% | 60d {m['ret60_pct']}% | força relativa vs Ibovespa 20d {_r(pick['rs20'], 1)} p.p., 60d {m['rs60_pp']} p.p.",
        f"Máxima 20d anterior R$ {m['prior_high20']} | mínima 10d R$ {m['low10']} | máx/mín 52 semanas R$ {m['high_52w']} / {m['low_52w']}",
        f"Plano calculado: entrada R$ {pick['entry']:.2f}, stop R$ {pick['stop']:.2f} (-{pick['risk_pct']:.1f}%), alvo 1 R$ {pick['target']:.2f} (2R), alvo 2 R$ {pick['target2']:.2f} (3R)",
        "Pontos fortes: " + ("; ".join(m["reasons"]) or "nenhum"),
        "Alertas: " + ("; ".join(m["warnings"]) or "nenhum"),
        "Notícias recentes:", *(news or ["nenhuma disponível"]),
    ])
    for model in MODELS:
        for _ in range(3):
            try:
                resp = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    max_completion_tokens=2000,
                    extra_body={"reasoning_effort": "low"},
                )
                data = json.loads(resp.choices[0].message.content)
                data["model"] = model
                data["news"] = news
                return data
            except RateLimitError as e:
                wait = float(e.response.headers.get("retry-after", 20)) if e.response is not None else 20
                print(f"    limite da Groq em {model}; aguardando {wait:.0f}s…")
                time.sleep(min(wait, 60) + 1)
            except (APIStatusError, json.JSONDecodeError) as e:
                print(f"    erro em {model}: {str(e)[:160]}")
                break
    return None


# ----------------------------------------------------------------------------- main

def main() -> int:
    for var in ("GROQ_API_KEY", "DATABASE_URL"):
        # Secrets colados com espaço ou quebra de linha no fim quebram a conexão.
        os.environ[var] = os.environ.get(var, "").strip()
        if not os.environ[var]:
            print(f"ERRO: defina a variável {var}", file=sys.stderr)
            return 1

    universe = (os.environ.get("SWING_UNIVERSE") or DEFAULT_UNIVERSE).replace(",", " ").split()
    universe = sorted({c.strip().upper().removesuffix(".SA") for c in universe if c.strip()})
    print(f"Baixando {len(universe)} ações + Ibovespa…")
    frames, ibov = download(universe)

    ibov_chg20 = None
    ibov_trend = "sem dados"
    if ibov is not None and len(ibov) > 50:
        ibov_chg20 = (ibov.iloc[-1] / ibov.iloc[-21] - 1) * 100
        above = ibov.iloc[-1] > ibov.rolling(50).mean().iloc[-1]
        ibov_trend = f"{'acima' if above else 'abaixo'} da MM50, {ibov_chg20:+.1f}% em 20 dias"

    results = [r for c, df in frames.items() if (r := evaluate(c, df, ibov))]
    results.sort(key=lambda r: (r["score"], r["rs20"] or -999), reverse=True)
    ranked = results[:KEEP]
    print(f"{len(frames)} com dados, {len(results)} passaram no filtro de liquidez. Ibovespa: {ibov_trend}")

    client = OpenAI(api_key=os.environ["GROQ_API_KEY"], base_url="https://api.groq.com/openai/v1",
                    timeout=120, max_retries=0)
    names: dict[str, str] = {}
    candidates = [r for r in ranked if r["score"] >= MIN_SCORE_FOR_AI and r["setup"] != "Sem setup"][:TOP_N]
    for i, pick in enumerate(candidates):
        try:
            info = yf.Ticker(f"{pick['code']}.SA").info or {}
        except Exception:  # noqa: BLE001
            info = {}
        names[pick["code"]] = info.get("longName") or info.get("shortName") or pick["code"]
        print(f"[IA {i + 1}/{len(candidates)}] {pick['code']} · {pick['setup']} · nota {pick['score']}")
        pick["ai"] = ai_review(client, pick, names[pick["code"]], ibov_trend)
        pick["selected"] = True
        if pick["ai"]:
            print(f"    {pick['ai'].get('veredito')} ({pick['ai'].get('confianca')})")
        if i < len(candidates) - 1:
            time.sleep(PAUSE_SECONDS)

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        cur.execute(SCHEMA_FILE.read_text(encoding="utf-8"))
        cur.execute(
            """INSERT INTO swing_runs (universe_size, screened, ibov_chg20, ibov_trend, params)
               VALUES (%s,%s,%s,%s,%s::jsonb) RETURNING id""",
            (len(universe), len(results), _r(ibov_chg20), ibov_trend, json.dumps({
                "min_fin_volume": MIN_FIN_VOLUME, "top_n": TOP_N, "min_score": MIN_SCORE_FOR_AI,
            })),
        )
        run_id = cur.fetchone()[0]
        for rank, p in enumerate(ranked, start=1):
            cur.execute(
                """INSERT INTO swing_picks (run_id, rank, code, name, setup, score, price, entry, stop,
                       target, target2, risk_pct, reward_pct, rsi, atr_pct, fin_volume, rs20,
                       selected, metrics, ai)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb)""",
                (run_id, rank, p["code"], names.get(p["code"]), p["setup"], p["score"],
                 _r(p["price"]), _r(p["entry"]), _r(p["stop"]), _r(p["target"]), _r(p["target2"]),
                 _r(p["risk_pct"]), _r(p["reward_pct"]), _r(p["rsi"], 1), _r(p["atr_pct"]),
                 _num(p["fin_volume"]), _r(p["rs20"]), p.get("selected", False),
                 json.dumps(p["metrics"], ensure_ascii=False),
                 json.dumps(p.get("ai"), ensure_ascii=False) if p.get("ai") else None),
            )
            # cotações recentes para os minigráficos
            df = frames[p["code"]].tail(60)
            cur.executemany(
                """INSERT INTO stock_daily (code, date, open, high, low, close, volume, data_source)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,'Yahoo Finance')
                   ON CONFLICT (code, date) DO UPDATE SET open = EXCLUDED.open, high = EXCLUDED.high,
                       low = EXCLUDED.low, close = EXCLUDED.close, volume = EXCLUDED.volume""",
                [(p["code"], ts.date(), _num(r["Open"]), _num(r["High"]), _num(r["Low"]),
                  _num(r["Close"]), _num(r["Volume"])) for ts, r in df.iterrows()],
            )
    print(f"Rodada {run_id} gravada: {len(ranked)} no ranking, {len(candidates)} avaliadas pela IA.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
