import { getStoredString, setStoredString } from "./storage";

export type PanasMoment = "before" | "after";
export type PanasKind = "positive" | "negative";
export type PanasAnswers = Record<number, number>;

export type PanasItem = { id: number; label: string; kind: PanasKind };

// 20 adjetivos do PANAS (Watson, Clark e Tellegen, 1988) na ordem original da escala.
// Verifique com o orientador qual adaptação validada em português deseja fixar antes da coleta final.
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

export type PanasRecord = {
  sessionId: string;
  moment: PanasMoment;
  answers: PanasAnswers;
  positive: number;
  negative: number;
  answeredAt: string;
};

export type ActiveTestSession = { sessionId: string; startedAt: string };

export type PanasDraftState = {
  active: ActiveTestSession | null;
  drafts: Partial<Record<PanasMoment, PanasAnswers>>;
};

const DRAFT_PREFIX = "psyconnect_panas_draft_v2_";

function draftKey(userId: string) {
  return `${DRAFT_PREFIX}${userId}`;
}

export async function loadPanasDraftState(userId: string): Promise<PanasDraftState> {
  try {
    const raw = await getStoredString(draftKey(userId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        return {
          active: (obj.active as ActiveTestSession | null) ?? null,
          drafts: (obj.drafts as Partial<Record<PanasMoment, PanasAnswers>>) ?? {},
        };
      }
    }
  } catch {
    // dados corrompidos: recomeça rascunho vazio
  }
  return { active: null, drafts: {} };
}

export async function savePanasDraftState(userId: string, state: PanasDraftState): Promise<void> {
  await setStoredString(draftKey(userId), JSON.stringify(state));
}
