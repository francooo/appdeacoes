# Design system: Análise de Ações

Base: seção 7 do `SISTEMA.md`, implementada em Tailwind CSS 4 + `globals.css`.
Este pacote traz os mesmos valores em CSS puro (`tokens.css`) e em JSON (`tokens.json`).
O guia visual com todos os componentes está em `componentes.html`.

## Princípios

1. **Dados em primeiro lugar:** números em Geist Mono com `tabular-nums`.
2. **Cor com significado:** verde = alta, vermelho = baixa/risco, âmbar = cautela. Nunca decorativa.
3. **Superfícies discretas:** cartões com borda fina e sem sombra.
4. **Tema claro e escuro automático:** `prefers-color-scheme` (ou as classes `.t-light` / `.t-dark`).
5. **Degradação elegante:** valor ausente vira "—", bloco vazio não aparece.

## Cores

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--background` | `#f7f8fa` | `#0b0e13` | Fundo da página, campos |
| `--foreground` | `#14171c` | `#e8ebf0` | Texto principal |
| `--surface` | `#ffffff` | `#12161d` | Cartões |
| `--surface-2` | `#eef0f3` | `#1b2029` | Etiquetas, áreas internas, hover |
| `--line` | `#e2e5ea` | `#232a35` | Bordas e divisores |
| `--muted` | `#5d6673` | `#8b95a5` | Texto secundário |

### Tons semânticos

| Classe | Cor | Significado |
|---|---|---|
| `.tone-strong-up` (`.su`) | `#059669` | Forte alta · Comprar · Operar |
| `.tone-up` (`.up`) | `#10b981` | Alta · Manter |
| `.tone-neutral` (`.ne`) | `#d97706` | Lateral · Observar · Aguardar |
| `.tone-down` (`.dn`) | `#dc2626` | Baixa · Reduzir · Vender · Evitar |

- `.tone-bg`: fundo com 15% da cor (`color-mix`) + texto no tom.
- `.tone-fg`: só o texto no tom.

**Ajuste de acessibilidade (novo):** no tema claro, o texto dos tons usa versões mais
escuras (`#047857` verde, `#b45309` âmbar, `#c81e1e` vermelho), porque `#10b981` e
`#d97706` sobre branco ficam abaixo de 4,5:1. No escuro: `#34d399`, `#fbbf24`, `#f87171`.
Variação positiva/negativa usa `.pos` / `.neg` com a mesma regra.

### Cores pontuais

| Uso | Valor |
|---|---|
| Botão primário | `#059669`, hover `#10b981` |
| Foco de campo | borda `#10b981` + anel `rgba(16,185,129,.2)` |
| Gráfico: fechamento / MM5 / MM20 | `#10b981` / `#38bdf8` / `#fbbf24` |
| Minigráfico | `#10b981` se subiu, `#ef4444` se caiu; área com 10% |
| Barras de composição | `#10b981` sobre trilho `--surface-2` |

## Tipografia

| Papel | Estilo |
|---|---|
| Texto geral | Geist 14 |
| Números, códigos, preços | Geist Mono + `tabular-nums` |
| Título de página | Geist 24 / 600 / tracking −0,02em |
| Código da ação (detalhe) | Geist Mono 30 / 600 |
| Valor de KPI | Geist Mono 26 / 600 |
| Título de cartão | Geist 14 / 600 |
| Rótulo | Geist 12, `--muted` |
| Corpo de relatório | Geist 14, altura 1,65, `white-space: pre-line` |

## Espaçamento e forma

| Elemento | Valor |
|---|---|
| Conteúdo | máx. 1280 px, margem 16 px, respiro vertical 32 px |
| Gap entre cartões | 16 px (KPIs: 12 px) |
| Padding de cartão | 20 px (KPIs: 16 px) |
| Raio | cartão 12 · campo/botão/nível 8 · etiqueta 6 · pílula 999 |
| Breakpoints | sm 640 · md 768 · lg 1024 · xl 1280 |

## Componentes (classes em `tokens.css`)

| Componente | Classe | Observação |
|---|---|---|
| Cartão | `.card`, `.card--link` | Hover com borda verde translúcida |
| ScoreBadge | `.score-badge` (+ `--large`) + tom + `.tone-bg` | 40×32 / 64×56 |
| Pílula | `.pill` + tom + `.tone-bg` | Ação, veredito, contadores |
| Chip | `.chip` | Etiqueta técnica, valor em `<b>` |
| Level | `.level`, `__label`, `__value`, `__pct` | Entrada, stop, alvos |
| Kpi | `.kpi`, `__label`, `__value`, `__hint` | Indicadores do topo |
| Stat | `.stat__label`, `.stat__value` | Pares dos cards do painel |
| Campo | `.input` | Foco verde com anel |
| Botões | `.btn-primary`, `.btn-ghost` | Desabilitado com opacidade 60% |
| Alerta | `.alert-error` | Usar com `role="alert"` |
| Tabela | `.table-wrap` + `.table` | Rola na horizontal, largura mínima 760 px |
| Barra | `.bar > span` | Composição da nota |
| Esqueleto | `.skeleton` | Pulsa; respeita `prefers-reduced-motion` |

## Mapeamentos de formatação

| Função | Regra |
|---|---|
| `scoreTone` | >70 Forte alta · >60 Alta · 40–60 Lateral · <40 Baixa |
| `actionTone` | buy/add → Comprar · hold → Manter · watch → Observar · reduce → Reduzir · sell/avoid → Vender/Evitar |
| `fmtPrice` / `fmtMoney` | 2 casas pt-BR; R$ quando `currency = "BRL"`, senão US$ |
| `fmtPct` | 2 casas, sinal explícito (`+1,25%`) |
| `fmtCompact` | `601,5 bi`, `25,3 mi` |
| `fmtDateTime` | `16/11/2026, 18:19`, fuso America/Sao_Paulo |
| Ausente | `—` |

## Ícones

Pasta `/icones`: SVG 24×24, traço 2 px, `stroke="currentColor"` (herdam a cor do texto).
Logo em `logo.svg` (quadrado verde 48×48), `logo-horizontal.svg` e `favicon.svg`.

## Acessibilidade

- `lang="pt-BR"`; gráficos com `role="img"` + `aria-label`; minigráficos com `aria-hidden`.
- Cor nunca é o único indicador: nota, veredito e variação têm texto ou sinal (+/−).
- Campos com `<label>` e `autocomplete`; erro com `role="alert"`; esqueleto com `aria-busy`.
