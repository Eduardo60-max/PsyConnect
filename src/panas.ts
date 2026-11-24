export type PanasMoment = "before" | "after";
export type PanasKind = "positive" | "negative";
export type PanasAnswers = Record<number, number>;

export type PanasItem = { id: number; label: string; kind: PanasKind };

// ATENÇÃO: tradução provisória dos 20 adjetivos do PANAS (Watson, Clark e Tellegen, 1988),
// na ordem original da escala. Confirme com o orientador qual versão validada em português
// usar (ex.: a adaptação brasileira de Carvalho et al., 2013) e ajuste só os "label" abaixo.
export const PANAS_ITEMS: PanasItem[] = [
  { id: 1, label: "Interessado", kind: "positive" },
  { id: 2, label: "Angustiado", kind: "negative" },
  { id: 3, label: "Estimulado", kind: "positive" },
  { id: 4, label: "Chateado", kind: "negative" },
  { id: 5, label: "Forte", kind: "positive" },
  { id: 6, label: "Culpado", kind: "negative" },
  { id: 7, label: "Assustado", kind: "negative" },
  { id: 8, label: "Hostil", kind: "negative" },
  { id: 9, label: "Entusiasmado", kind: "positive" },
  { id: 10, label: "Orgulhoso", kind: "positive" },
  { id: 11, label: "Irritável", kind: "negative" },
  { id: 12, label: "Alerta", kind: "positive" },
  { id: 13, label: "Envergonhado", kind: "negative" },
  { id: 14, label: "Inspirado", kind: "positive" },
  { id: 15, label: "Nervoso", kind: "negative" },
  { id: 16, label: "Determinado", kind: "positive" },
  { id: 17, label: "Atento", kind: "positive" },
  { id: 18, label: "Agitado", kind: "negative" },
  { id: 19, label: "Ativo", kind: "positive" },
  { id: 20, label: "Amedrontado", kind: "negative" },
];

export const PANAS_SCALE = [
  { value: 1, label: "Nada ou muito ligeiramente" },
  { value: 2, label: "Um pouco" },
  { value: 3, label: "Moderadamente" },
  { value: 4, label: "Bastante" },
  { value: 5, label: "Extremamente" },
] as const;

export type PanasScore = { positive: number; negative: number };

export function countAnswered(answers: PanasAnswers): number {
  return PANAS_ITEMS.filter(item => {
    const value = answers[item.id];
    return Number.isInteger(value) && value! >= 1 && value! <= 5;
  }).length;
}

export function isComplete(answers: PanasAnswers): boolean {
  return countAnswered(answers) === PANAS_ITEMS.length;
}

// Soma os 10 itens positivos e os 10 negativos separadamente (cada nota vai de 10 a 50)
export function scorePanas(answers: PanasAnswers): PanasScore | null {
  if (!isComplete(answers)) return null;
  let positive = 0;
  let negative = 0;
  for (const item of PANAS_ITEMS) {
    const value = answers[item.id] ?? 0;
    if (item.kind === "positive") positive += value;
    else negative += value;
  }
  return { positive, negative };
}

// ---------------------------------------------------------------------------
// Armazenamento local (TEMPORÁRIO: na fase do Supabase, grave em survey_responses)
// ---------------------------------------------------------------------------
export type PanasRecord = {
  sessionId: string;
  moment: PanasMoment;
  answers: PanasAnswers;
  positive: number;
  negative: number;
  answeredAt: string;
};

export type ActiveSession = { sessionId: string; startedAt: string };

export type PanasStore = {
  code: string; // código anônimo do participante (não é o e-mail)
  active: ActiveSession | null;
  records: PanasRecord[];
  drafts: Partial<Record<PanasMoment, PanasAnswers>>;
};

const STORE_PREFIX = "psyconect_panas_v1_";

function storeKey(email: string) {
  return `${STORE_PREFIX}${email.trim().toLowerCase()}`;
}

function newStore(): PanasStore {
  const code = `P-${Math.floor(1000 + Math.random() * 9000)}`;
  return { code, active: null, records: [], drafts: {} };
}

function isStore(value: unknown): value is PanasStore {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.code === "string" &&
    Array.isArray(item.records) &&
    typeof item.drafts === "object" &&
    item.drafts !== null
  );
}

export function loadStore(email: string): PanasStore {
  try {
    const raw = window.localStorage.getItem(storeKey(email));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStore(parsed)) return { ...parsed, active: parsed.active ?? null };
    }
  } catch {
    // dados corrompidos ou armazenamento bloqueado: recomeça
  }
  return newStore();
}

export function saveStore(email: string, store: PanasStore) {
  try {
    window.localStorage.setItem(storeKey(email), JSON.stringify(store));
  } catch {
    // sem espaço ou armazenamento bloqueado: só não persiste
  }
}

// ---------------------------------------------------------------------------
// Exportação (sem e-mail: só o código anônimo)
// ---------------------------------------------------------------------------
export function buildCsv(store: PanasStore): string {
  const header = [
    "codigo_participante",
    "sessao",
    "momento",
    "data",
    ...PANAS_ITEMS.map(item => `item_${item.id}_${item.label.toLowerCase()}`),
    "afeto_positivo",
    "afeto_negativo",
  ];

  const lines = store.records.map(record =>
    [
      store.code,
      record.sessionId,
      record.moment === "before" ? "antes" : "depois",
      record.answeredAt,
      ...PANAS_ITEMS.map(item => String(record.answers[item.id] ?? "")),
      String(record.positive),
      String(record.negative),
    ].join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

export function downloadCsv(store: PanasStore) {
  const blob = new Blob([`\uFEFF${buildCsv(store)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `panas-${store.code}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}