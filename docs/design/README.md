# Análise de Ações · telas estáticas e design system

Mockups estáticos das telas descritas no `SISTEMA.md` (commit `15aa36b`).
Os dados (preços, notas, notícias, textos de IA) são **fictícios**, só para preencher o layout.

## Conteúdo

```
telas/                   HTML estático, abre direto no navegador (links entre telas funcionam)
  login.html             /login
  painel.html            /  (Painel do dia)
  acao-petr4.html        /acao/[code]  (exemplo: PETR4)
  swing.html             /swing
  escuro/                as mesmas 4 telas no tema escuro
design-system/
  DESIGN-SYSTEM.md       documentação: princípios, cores, tipografia, espaçamento, componentes
  tokens.css             tokens (claro/escuro) + classes de componente em CSS puro
  tokens.json            os mesmos tokens em JSON
  componentes.html       guia visual com cores, tipografia, ícones e componentes
icones/                  SVGs 24×24 (currentColor), logo, logo horizontal e favicon
fonte-design/            arquivos-fonte do canvas do Claude Design (.dc.html + canvas.json)
```

## Como usar

- Abra `telas/painel.html` e navegue pelo menu, pelos cards e por "Sair".
- Abra `design-system/componentes.html` e use o botão "Alternar tema" para ver o escuro.
- As fontes Geist e Geist Mono são carregadas do Google Fonts (precisa de internet).
  Sem conexão, o navegador usa a fonte do sistema.
