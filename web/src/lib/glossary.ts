/** Explicações curtas exibidas nos balões (InfoTip) da tela de swing trade. */

export const GLOSSARY = {
  nota: "Pontuação técnica de 0 a 100: tendência, momento, força contra o Ibovespa e setup. Quanto maior, melhor o quadro gráfico.",
  setup:
    "Padrão gráfico encontrado. Rompimento: passou da máxima de 20 dias com volume alto. Pullback: recuou até a MM20 em tendência de alta. Tendência de alta: sobe de forma consistente.",
  preco: "Último preço de fechamento usado na análise.",
  entrada:
    "Preço de referência da análise (último fechamento). A compra só deve ser feita quando o gatilho de entrada acontecer.",
  stop: "Preço de saída para limitar o prejuízo. Se a ação cair até esse valor, venda e encerre a operação. Vale por preço, não por prazo: pode acontecer no 1º dia ou no 10º.",
  alvo2r:
    "Preço para realizar o lucro. R é o seu risco (entrada − stop); 2R é ganhar o dobro do que arrisca. Ex.: entrada R$ 10 e stop R$ 9 → R = R$ 1 → alvo R$ 12.",
  alvo1: "Primeiro alvo de lucro = 2R: ganho de 2× o risco (entrada − stop). Costuma-se vender parte da posição aqui.",
  alvo2: "Segundo alvo de lucro = 3R: ganho de 3× o risco. Para a parte da posição que você manteve após o alvo 1.",
  risco: "Quanto o preço cai, em %, até o stop. É a perda por ação se o stop for acionado.",
  rsi: "Índice de força (0–100). Entre 50 e 68 indica alta saudável; acima de 70, sobrecomprado (risco de correção).",
  atr: "Oscilação média diária da ação (14 dias). Quanto maior, mais volátil e mais distante o stop precisa ficar.",
  vsIbov: "Desempenho da ação nos últimos 20 dias menos o do Ibovespa, em pontos percentuais. Positivo = mais forte que o mercado.",
  liquidez: "Volume financeiro médio negociado por dia (20 dias). Mais liquidez = mais fácil comprar e vender pelo preço visto.",
  volume: "Volume do último pregão comparado à média de 20 dias. Ex.: 1,5x = 50% acima do normal.",
  distMM20: "Distância do preço até a média de 20 dias. Muito acima (> 8%) indica ação esticada, com risco de recuo.",
  horizonte:
    "Prazo estimado pela IA para a operação. Se nem o stop nem o alvo forem atingidos nesse período, reavalie ou encerre.",
  ia: "Veredito da IA para o setup. Passe o mouse sobre cada veredito para ver o que fazer.",
  gatilho: "Condição objetiva que precisa acontecer antes de comprar. Sem o gatilho, não entre.",
  gestao: "Como conduzir a operação depois de entrar: onde subir o stop, quando realizar parcial etc.",
} as const;

const VERDICTS: Record<string, string> = {
  Operar:
    "Setup válido. Compre somente quando o gatilho de entrada acontecer, já com stop e alvo definidos.",
  Aguardar:
    "Ainda não compre. Espere o gatilho de entrada acontecer (ex.: fechar acima de um preço). Se não acontecer, não opere.",
  Evitar: "Não opere. O risco está maior que o potencial de ganho neste momento.",
};

/** Explicação do veredito, com o gatilho específico da ação quando houver. */
export function verdictHelp(veredito: string, gatilho?: string | null): string {
  const base = VERDICTS[veredito] ?? "Avaliação da IA sobre o setup.";
  return gatilho && veredito !== "Evitar" ? `${base}\nGatilho: ${gatilho}` : base;
}
