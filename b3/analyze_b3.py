"""Análise diária de ações da B3 com dados do Yahoo Finance + IA (Groq).

Gera relatórios no mesmo formato do daily_stock_analysis (campos de AnalysisResult
e "dashboard") e grava direto no Postgres usado pelo app web.

Uso:
    B3_STOCK_LIST=PETR4,VALE3 GROQ_API_KEY=... DATABASE_URL=... python b3/analyze_b3.py
    python b3/analyze_b3.py PETR4 VALE3        # tickers pela linha de comando
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import psycopg
import yfinance as yf
from openai import APIStatusError, OpenAI, RateLimitError

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_FILE = ROOT / "db" / "schema.sql"
BRT = ZoneInfo("America/Sao_Paulo")

DEFAULT_STOCKS = "PETR4,VALE3,ITUB4,BBDC4,BBAS3,ABEV3,WEGE3,B3SA3,ITSA4,RENT3,SUZB3,MGLU3"
MODELS = [m.strip() for m in os.environ.get(
    "GROQ_MODELS", "openai/gpt-oss-120b,openai/gpt-oss-20b").split(",") if m.strip()]
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
# Pausa entre ações: o plano gratuito da Groq permite ~8.000 tokens/min por modelo.
PAUSE_SECONDS = float(os.environ.get("B3_PAUSE_SECONDS", "30"))


# ----------------------------------------------------------------------------- dados

def _num(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def _r(v, nd=2):
    v = _num(v)
    return None if v is None else round(v, nd)


def fetch(code: str) -> dict:
    """Busca histórico, fundamentos e notícias no Yahoo Finance."""
    ticker = yf.Ticker(f"{code}.SA")
    hist = ticker.history(period="1y", auto_adjust=False)
    if hist.empty or len(hist) < 30:
        raise RuntimeError(f"Yahoo Finance sem histórico suficiente para {code}.SA")
    hist = hist.dropna(subset=["Close"])
    try:
        info = ticker.info or {}
    except Exception:  # noqa: BLE001 - info falha às vezes; seguimos sem fundamentos
        info = {}
    news = []
    try:
        for item in (ticker.news or [])[:8]:
            c = item.get("content", item)
            title = c.get("title")
            if not title:
                continue
            news.append({
                "title": title,
                "date": (c.get("pubDate") or "")[:10],
                "publisher": ((c.get("provider") or {}).get("displayName") if isinstance(c.get("provider"), dict) else None),
                "summary": (c.get("summary") or "")[:280],
            })
    except Exception:  # noqa: BLE001
        pass
    return {"hist": hist, "info": info, "news": news}


def indicators(hist: pd.DataFrame) -> dict:
    close, vol = hist["Close"], hist["Volume"]
    ma = {n: close.rolling(n).mean() for n in (5, 10, 20, 60)}
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean()
    rsi = 100 - 100 / (1 + gain / loss.replace(0, float("nan")))
    ema12, ema26 = close.ewm(span=12, adjust=False).mean(), close.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()

    last = hist.iloc[-1]
    prev_close = close.iloc[-2]
    price = close.iloc[-1]
    ma5, ma10, ma20, ma60 = (ma[n].iloc[-1] for n in (5, 10, 20, 60))
    vol_ratio = vol.iloc[-1] / vol.iloc[-6:-1].mean() if vol.iloc[-6:-1].mean() else None
    window = hist.tail(20)
    return {
        "price": price,
        "prev_close": prev_close,
        "change_pct": (price / prev_close - 1) * 100,
        "open": last["Open"], "high": last["High"], "low": last["Low"], "volume": last["Volume"],
        "amplitude": (last["High"] - last["Low"]) / prev_close * 100,
        "ma5": ma5, "ma10": ma10, "ma20": ma20, "ma60": ma60,
        "bias_ma5": (price / ma5 - 1) * 100,
        "rsi14": rsi.iloc[-1],
        "macd": macd.iloc[-1], "macd_signal": signal.iloc[-1], "macd_hist": (macd - signal).iloc[-1],
        "volume_ratio": vol_ratio,
        "support_20d": window["Low"].min(),
        "resistance_20d": window["High"].max(),
        "chg_5d": (price / close.iloc[-6] - 1) * 100,
        "chg_20d": (price / close.iloc[-21] - 1) * 100,
        "chg_60d": (price / close.iloc[-61] - 1) * 100 if len(close) > 61 else None,
        "high_52w": close.max(), "low_52w": close.min(),
        "bullish_alignment": bool(ma5 > ma10 > ma20),
        "date": hist.index[-1].date().isoformat(),
        "series": {"ma5": ma[5], "ma10": ma[10], "ma20": ma[20]},
    }


# ----------------------------------------------------------------------------- prompt

SYSTEM = """Você é um analista de ações da B3 (bolsa brasileira). Analise SOMENTE com os dados fornecidos.
Regras:
- Responda em português do Brasil, de forma objetiva. Preços em reais (R$).
- Se um dado não foi fornecido, diga que não está disponível; não invente números, notícias ou eventos.
- Seja conservador: alinhamento de médias, RSI, MACD, volume, fundamentos e notícias devem convergir para recomendar compra.
- Pontos de entrada/saída devem ser coerentes com o preço atual, suportes e resistências.
- Responda APENAS com um objeto JSON válido no formato pedido."""

SCHEMA_HINT = """{
  "sentiment_score": inteiro 0-100 (>70 forte alta, 60-70 alta, 40-60 lateral, <40 baixa),
  "trend_prediction": "Forte alta" | "Alta" | "Lateral" | "Baixa" | "Forte baixa",
  "operation_advice": recomendação curta, ex. "Comprar", "Manter e observar", "Reduzir",
  "action": "buy" | "add" | "hold" | "watch" | "reduce" | "sell" | "avoid",
  "confidence_level": "Alta" | "Média" | "Baixa",
  "analysis_summary": 3-4 frases,
  "key_points": 3-5 pontos separados por "; ",
  "risk_warning": texto, "buy_reason": texto,
  "short_term_outlook": 1-3 dias, "medium_term_outlook": 1-2 semanas,
  "trend_analysis": texto, "technical_analysis": texto, "ma_analysis": texto, "volume_analysis": texto,
  "fundamental_analysis": texto, "company_highlights": texto, "sector_position": texto,
  "news_summary": texto, "market_sentiment": texto,
  "dashboard": {
    "core_conclusion": {"signal_type": ex. "🟢 Compra" | "🟡 Manter/Observar" | "🔴 Venda",
      "one_sentence": 1 frase, "time_sensitivity": texto curto,
      "position_advice": {"no_position": texto, "has_position": texto}},
    "battle_plan": {
      "sniper_points": {"ideal_buy": número, "secondary_buy": número, "stop_loss": número, "take_profit": número},
      "action_checklist": ["✅/⚠️/❌ item", ... 4-6 itens],
      "position_strategy": {"suggested_position": ex. "3/10 do capital", "entry_plan": texto, "risk_control": texto}},
    "intelligence": {"latest_news": texto, "sentiment_summary": texto, "earnings_outlook": texto,
      "positive_catalysts": [texto], "risk_alerts": [texto]},
    "phase_decision": {"immediate_action": texto, "watch_conditions": [texto], "next_check_time": texto},
    "signal_attribution": {"technical_indicators": 0-100, "fundamentals": 0-100, "market_conditions": 0-100,
      "news_sentiment": 0-100 (os quatro somam 100), "strongest_bullish_signal": texto, "strongest_bearish_signal": texto}
  }
}"""


def build_prompt(code: str, name: str, ind: dict, info: dict, news: list[dict]) -> str:
    f = lambda v, nd=2: "n/d" if _num(v) is None else f"{_num(v):.{nd}f}"  # noqa: E731
    pct = lambda v: "n/d" if _num(v) is None else f"{_num(v) * 100:.1f}%"  # noqa: E731
    dy = _num(info.get("dividendYield"))
    lines = [
        f"Ação: {code} ({name}) — B3, cotação em R$. Data do último pregão: {ind['date']}.",
        f"Setor: {info.get('sector') or 'n/d'} / {info.get('industry') or 'n/d'}",
        "",
        "## Preço",
        f"Atual {f(ind['price'])} | variação dia {f(ind['change_pct'])}% | abertura {f(ind['open'])} | máx {f(ind['high'])} | mín {f(ind['low'])}",
        f"Variação 5d {f(ind['chg_5d'])}% | 20d {f(ind['chg_20d'])}% | 60d {f(ind['chg_60d'])}%",
        f"Máx 52s {f(ind['high_52w'])} | Mín 52s {f(ind['low_52w'])}",
        "",
        "## Técnicos",
        f"MM5 {f(ind['ma5'])} | MM10 {f(ind['ma10'])} | MM20 {f(ind['ma20'])} | MM60 {f(ind['ma60'])}",
        f"Alinhamento de alta (MM5>MM10>MM20): {'sim' if ind['bullish_alignment'] else 'não'} | desvio da MM5 {f(ind['bias_ma5'])}%",
        f"RSI14 {f(ind['rsi14'], 1)} | MACD {f(ind['macd'], 3)} sinal {f(ind['macd_signal'], 3)} histograma {f(ind['macd_hist'], 3)}",
        f"Volume do dia vs média 5d: {f(ind['volume_ratio'])}x",
        f"Suporte 20d {f(ind['support_20d'])} | Resistência 20d {f(ind['resistance_20d'])}",
        "",
        "## Fundamentos (Yahoo Finance)",
        f"Valor de mercado {f(_num(info.get('marketCap')) and _num(info.get('marketCap')) / 1e9, 1)} bi | P/L {f(info.get('trailingPE'))} | P/L projetado {f(info.get('forwardPE'))} | P/VP {f(info.get('priceToBook'))}",
        f"ROE {pct(info.get('returnOnEquity'))} | margem líquida {pct(info.get('profitMargins'))} | dívida/PL {f(info.get('debtToEquity'))} | dividend yield {'n/d' if dy is None else f'{dy:.2f}%'}",
        f"Crescimento receita {pct(info.get('revenueGrowth'))} | crescimento lucro {pct(info.get('earningsGrowth'))}",
        f"Consenso de analistas: {info.get('recommendationKey') or 'n/d'} ({info.get('numberOfAnalystOpinions') or 'n/d'} analistas) | preço-alvo médio {f(info.get('targetMeanPrice'))} (mín {f(info.get('targetLowPrice'))}, máx {f(info.get('targetHighPrice'))})",
        "",
        "## Notícias recentes",
    ]
    if news:
        lines += [f"- [{n['date']}] {n['title']}" + (f" — {n['summary']}" if n["summary"] else "") for n in news]
    else:
        lines.append("Nenhuma notícia disponível.")
    lines += ["", "Responda com um JSON neste formato:", SCHEMA_HINT]
    return "\n".join(lines)


# ----------------------------------------------------------------------------- IA

def ask_llm(client: OpenAI, prompt: str) -> tuple[dict, str]:
    last_err: Exception | None = None
    for model in MODELS:
        for attempt in range(3):
            try:
                resp = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                    max_completion_tokens=4000,
                    extra_body={"reasoning_effort": "low"},
                )
                return json.loads(resp.choices[0].message.content), model
            except RateLimitError as e:
                last_err = e
                wait = float(e.response.headers.get("retry-after", 20)) if e.response is not None else 20
                print(f"    limite da Groq em {model}; aguardando {wait:.0f}s…")
                time.sleep(min(wait, 60) + 1)
            except (APIStatusError, json.JSONDecodeError) as e:
                last_err = e
                print(f"    erro em {model}: {str(e)[:160]}")
                break  # tenta o próximo modelo
    raise RuntimeError(f"Todos os modelos falharam: {last_err}")


# ----------------------------------------------------------------------------- montagem

def build_result(code: str, name: str, ind: dict, info: dict, ai: dict, model: str, news: list[dict]) -> dict:
    dash = ai.get("dashboard") or {}
    dash["data_perspective"] = {
        "trend_status": {
            "is_bullish": ind["bullish_alignment"],
            "ma_alignment": f"MM5 {ind['ma5']:.2f} / MM10 {ind['ma10']:.2f} / MM20 {ind['ma20']:.2f}",
            "trend_score": ai.get("sentiment_score"),
        },
        "price_position": {
            "current_price": _r(ind["price"]), "ma5": _r(ind["ma5"]), "ma10": _r(ind["ma10"]),
            "ma20": _r(ind["ma20"]), "bias_ma5": _r(ind["bias_ma5"]),
            "support_level": _r(ind["support_20d"]), "resistance_level": _r(ind["resistance_20d"]),
        },
        "volume_analysis": {
            "volume_ratio": _r(ind["volume_ratio"]),
            "volume_status": "Volume acima da média" if (ind["volume_ratio"] or 0) > 1.2
            else "Volume abaixo da média" if (ind["volume_ratio"] or 1) < 0.8 else "Volume normal",
        },
    }
    result = {k: v for k, v in ai.items() if k != "dashboard"}
    result.update({
        "code": code,
        "name": name,
        "market": "br",
        "currency": "BRL",
        "report_language": "pt",
        "model_used": f"groq/{model}",
        "current_price": _r(ind["price"]),
        "change_pct": _r(ind["change_pct"]),
        "decision_type": ai.get("action"),
        "dashboard": dash,
        "market_snapshot": {
            "date": ind["date"], "open": _r(ind["open"]), "high": _r(ind["high"]), "low": _r(ind["low"]),
            "close": _r(ind["price"]), "prev_close": _r(ind["prev_close"]), "volume": _num(ind["volume"]),
            "pct_chg": _r(ind["change_pct"]), "amplitude": _r(ind["amplitude"]),
            "volume_ratio": _r(ind["volume_ratio"]), "source": "Yahoo Finance",
        },
        "technicals": {
            "rsi14": _r(ind["rsi14"], 1), "macd": _r(ind["macd"], 3), "macd_signal": _r(ind["macd_signal"], 3),
            "ma60": _r(ind["ma60"]), "chg_5d": _r(ind["chg_5d"]), "chg_20d": _r(ind["chg_20d"]),
            "chg_60d": _r(ind["chg_60d"]), "high_52w": _r(ind["high_52w"]), "low_52w": _r(ind["low_52w"]),
        },
        "fundamentals": {
            "sector": info.get("sector"), "industry": info.get("industry"),
            "market_cap": _num(info.get("marketCap")), "pe": _r(info.get("trailingPE")),
            "forward_pe": _r(info.get("forwardPE")), "pb": _r(info.get("priceToBook")),
            "roe": _r(_num(info.get("returnOnEquity")) and _num(info.get("returnOnEquity")) * 100, 1),
            "dividend_yield": _r(info.get("dividendYield")),
            "recommendation": info.get("recommendationKey"), "analysts": info.get("numberOfAnalystOpinions"),
            "target_mean": _r(info.get("targetMeanPrice")),
        },
        "news": news,
        "data_sources": "Yahoo Finance (cotações, fundamentos, notícias)",
        "success": True,
    })
    return result


def save(conn: psycopg.Connection, code: str, name: str, result: dict, hist: pd.DataFrame, ind: dict) -> None:
    sp = (result.get("dashboard") or {}).get("battle_plan", {}).get("sniper_points", {})
    news_text = "\n".join(f"[{n['date']}] {n['title']}" for n in result.get("news", []))
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO analyses (query_id, code, name, report_type, sentiment_score, operation_advice,
                   trend_prediction, analysis_summary, raw_result, news_content,
                   ideal_buy, secondary_buy, stop_loss, take_profit, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s)""",
            (
                f"b3-{datetime.now(BRT):%Y%m%d}", code, name, "b3", result.get("sentiment_score"),
                result.get("operation_advice"), result.get("trend_prediction"), result.get("analysis_summary"),
                json.dumps(result, ensure_ascii=False, default=str), news_text,
                _num(sp.get("ideal_buy")), _num(sp.get("secondary_buy")),
                _num(sp.get("stop_loss")), _num(sp.get("take_profit")),
                datetime.now(timezone.utc),
            ),
        )
        rows = []
        tail = hist.tail(120)
        series = ind["series"]
        for ts, r in tail.iterrows():
            prev = hist["Close"].shift(1).loc[ts]
            rows.append((
                code, ts.date(), _num(r["Open"]), _num(r["High"]), _num(r["Low"]), _num(r["Close"]),
                _num(r["Volume"]), None, _num((r["Close"] / prev - 1) * 100) if _num(prev) else None,
                _num(series["ma5"].loc[ts]), _num(series["ma10"].loc[ts]), _num(series["ma20"].loc[ts]),
                None, "Yahoo Finance",
            ))
        cur.executemany(
            """INSERT INTO stock_daily (code, date, open, high, low, close, volume, amount, pct_chg,
                   ma5, ma10, ma20, volume_ratio, data_source)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (code, date) DO UPDATE SET
                   open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close,
                   volume = EXCLUDED.volume, pct_chg = EXCLUDED.pct_chg, ma5 = EXCLUDED.ma5,
                   ma10 = EXCLUDED.ma10, ma20 = EXCLUDED.ma20, data_source = EXCLUDED.data_source""",
            rows,
        )
    conn.commit()


# ----------------------------------------------------------------------------- main

def main() -> int:
    for var in ("GROQ_API_KEY", "DATABASE_URL"):
        if not os.environ.get(var):
            print(f"ERRO: defina a variável {var}", file=sys.stderr)
            return 1
    codes = sys.argv[1:] or os.environ.get("B3_STOCK_LIST", DEFAULT_STOCKS).split(",")
    codes = [c.strip().upper().removesuffix(".SA") for c in codes if c.strip()]

    client = OpenAI(api_key=os.environ["GROQ_API_KEY"], base_url=GROQ_BASE_URL, timeout=120, max_retries=0)
    ok, failed = 0, []
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_FILE.read_text(encoding="utf-8"))
        conn.commit()

        for i, code in enumerate(codes):
            started = time.monotonic()
            print(f"[{i + 1}/{len(codes)}] {code}")
            try:
                data = fetch(code)
                info = data["info"]
                name = info.get("longName") or info.get("shortName") or code
                ind = indicators(data["hist"])
                ai, model = ask_llm(client, build_prompt(code, name, ind, info, data["news"]))
                result = build_result(code, name, ind, info, ai, model, data["news"])
                save(conn, code, name, result, data["hist"], ind)
                ok += 1
                print(f"    nota {result.get('sentiment_score')} · {result.get('operation_advice')} · {model}")
            except Exception as e:  # noqa: BLE001 - uma ação com erro não derruba as demais
                conn.rollback()
                failed.append(code)
                print(f"    FALHOU: {str(e)[:200]}")
            if i < len(codes) - 1:
                time.sleep(max(0.0, PAUSE_SECONDS - (time.monotonic() - started)))

    print(f"Concluído: {ok} ok, {len(failed)} falharam {failed if failed else ''}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
