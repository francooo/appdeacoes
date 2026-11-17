# appdeacoes

Sistema web com login que mostra as análises diárias de ações geradas pelo
[daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis).

## Arquitetura

```
GitHub Actions (seg–sex, 18:30 BRT)
  ├─ b3/analyze_b3.py: Yahoo Finance (.SA) + Groq → Postgres (Neon)   [principal]
  └─ EUA (opcional, ENABLE_US=true):
       daily_stock_analysis (Python + Groq) → SQLite → sync/sync_to_postgres.py → Postgres
                                                  │
Vercel: Next.js (web/)  ◄─────────────────────────┘
  /login        tela de login (e-mail + senha, sessão em cookie JWT)
  /             painel com a última análise de cada ação
  /acao/[code]  detalhe: nota, recomendação, pontos de entrada/saída, gráfico, histórico
```

| Pasta | O que é |
|---|---|
| `b3/` | Analisador da B3: dados do Yahoo Finance, indicadores, IA em português, grava no Postgres |
| `daily_stock_analysis/` | Submódulo com o projeto original (não editar aqui), usado para ações dos EUA |
| `sync/` | Script que copia os resultados do SQLite para o Postgres |
| `db/schema.sql` | Tabelas do Postgres (`users`, `analyses`, `stock_daily`) |
| `web/` | App Next.js publicado na Vercel |
| `.github/workflows/daily-analysis.yml` | Agendamento da análise + sincronização |

## Rodar localmente

```powershell
# 1. App web
cd web
copy .env.example .env.local    # preencha DATABASE_URL e AUTH_SECRET
npm install
npm run create-user -- voce@exemplo.com "Seu Nome" "senha-forte"
npm run dev                      # http://localhost:3000

# 2. Gerar uma análise e enviar ao banco (opcional, local)
cd ..\daily_stock_analysis
.venv\Scripts\python.exe main.py --no-market-review --force-run
$env:DATABASE_URL = "postgresql://..."; $env:SOURCE_TZ = "America/Sao_Paulo"
.venv\Scripts\python.exe ..\sync\sync_to_postgres.py
```

## Deploy

**GitHub** (Settings → Secrets and variables → Actions):

| Tipo | Nome | Valor |
|---|---|---|
| Secret | `GROQ_API_KEY` | chave da Groq (console.groq.com/keys) |
| Secret | `DATABASE_URL` | connection string do Neon |
| Variable (opcional) | `B3_STOCK_LIST` | ações da B3 sem `.SA`, ex.: `PETR4,VALE3,WEGE3` |
| Variable (opcional) | `ENABLE_US` | `true` para também rodar ações dos EUA |
| Variable (opcional) | `STOCK_LIST` | ações dos EUA (padrão: AAPL,MSFT,NVDA,GOOGL,AMZN) |
| Secret (opcional) | `TAVILY_API_KEYS` / `SERPAPI_API_KEYS` | busca de notícias, melhora a análise |

**Vercel**: importe o repositório, defina **Root Directory = `web`** e cadastre as
variáveis `DATABASE_URL` e `AUTH_SECRET`.

> As análises são geradas por IA e servem apenas para estudo, não são recomendação de investimento.
