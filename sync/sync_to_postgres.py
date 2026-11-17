"""Copia os resultados do daily_stock_analysis (SQLite) para o Postgres (Neon).

Uso:
    DATABASE_URL=postgresql://... python sync/sync_to_postgres.py [caminho/para/stock_analysis.db]

Idempotente: registros já existentes são atualizados (upsert), nunca duplicados.
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE = ROOT / "daily_stock_analysis" / "data" / "stock_analysis.db"
SCHEMA_FILE = ROOT / "db" / "schema.sql"

# O daily_stock_analysis grava datetime.now() sem fuso. Informe o fuso da máquina
# que rodou a análise (GitHub Actions = UTC).
SOURCE_TZ = ZoneInfo(os.environ.get("SOURCE_TZ", "UTC"))


def to_aware(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=SOURCE_TZ)


def to_json(value: str | None) -> str | None:
    if not value:
        return None
    try:
        json.loads(value)
        return value
    except (TypeError, ValueError):
        return json.dumps({"text": value})


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERRO: defina a variável DATABASE_URL", file=sys.stderr)
        return 1

    sqlite_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SQLITE
    if not sqlite_path.exists():
        print(f"ERRO: banco SQLite não encontrado em {sqlite_path}", file=sys.stderr)
        return 1

    src = sqlite3.connect(sqlite_path)
    src.row_factory = sqlite3.Row

    analyses = src.execute(
        """SELECT query_id, code, name, report_type, sentiment_score, operation_advice,
                  trend_prediction, analysis_summary, raw_result, news_content,
                  ideal_buy, secondary_buy, stop_loss, take_profit, created_at
           FROM analysis_history"""
    ).fetchall()
    daily = src.execute(
        """SELECT code, date, open, high, low, close, volume, amount, pct_chg,
                  ma5, ma10, ma20, volume_ratio, data_source
           FROM stock_daily"""
    ).fetchall()
    src.close()

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.execute(SCHEMA_FILE.read_text(encoding="utf-8"))

        cur.executemany(
            """INSERT INTO analyses (query_id, code, name, report_type, sentiment_score,
                   operation_advice, trend_prediction, analysis_summary, raw_result,
                   news_content, ideal_buy, secondary_buy, stop_loss, take_profit, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (code, created_at) DO UPDATE SET
                   name = EXCLUDED.name,
                   sentiment_score = EXCLUDED.sentiment_score,
                   operation_advice = EXCLUDED.operation_advice,
                   trend_prediction = EXCLUDED.trend_prediction,
                   analysis_summary = EXCLUDED.analysis_summary,
                   raw_result = EXCLUDED.raw_result,
                   news_content = EXCLUDED.news_content,
                   ideal_buy = EXCLUDED.ideal_buy,
                   secondary_buy = EXCLUDED.secondary_buy,
                   stop_loss = EXCLUDED.stop_loss,
                   take_profit = EXCLUDED.take_profit,
                   synced_at = now()""",
            [
                (
                    r["query_id"], r["code"], r["name"], r["report_type"], r["sentiment_score"],
                    r["operation_advice"], r["trend_prediction"], r["analysis_summary"],
                    to_json(r["raw_result"]), r["news_content"], r["ideal_buy"],
                    r["secondary_buy"], r["stop_loss"], r["take_profit"],
                    to_aware(r["created_at"]),
                )
                for r in analyses
            ],
        )

        cur.executemany(
            """INSERT INTO stock_daily (code, date, open, high, low, close, volume, amount,
                   pct_chg, ma5, ma10, ma20, volume_ratio, data_source)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (code, date) DO UPDATE SET
                   open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
                   close = EXCLUDED.close, volume = EXCLUDED.volume, amount = EXCLUDED.amount,
                   pct_chg = EXCLUDED.pct_chg, ma5 = EXCLUDED.ma5, ma10 = EXCLUDED.ma10,
                   ma20 = EXCLUDED.ma20, volume_ratio = EXCLUDED.volume_ratio,
                   data_source = EXCLUDED.data_source""",
            [tuple(r) for r in daily],
        )

    print(
        f"Sincronizado em {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC: "
        f"{len(analyses)} análises, {len(daily)} linhas de cotação."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
