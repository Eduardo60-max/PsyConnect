import { PANAS_ITEMS, scorePanas, type PanasAnswers, type PanasMoment, type PanasRecord } from "./panas";
import type { AdminSurveyRow, AdminSurveySummary } from "./types";
import type { AuthContext } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseServer";
import { csvCell } from "./timeUtils";

type SurveyRow = {
  id: string;
  anonymous_code: string;
  instrument: "PANAS" | "SUS";
  session_id: string;
  moment: "before" | "after" | "final";
  answers: Record<string, number>;
  score_positive: number | null;
  score_negative: number | null;
  score_total: number | null;
  created_at: string;
};

function normalizeAnswers(raw: unknown): PanasAnswers | null {
  if (typeof raw !== "object" || raw === null) return null;
  const parsed: PanasAnswers = {};
  for (const item of PANAS_ITEMS) {
    const val = Number((raw as Record<string, unknown>)[String(item.id)]);
    if (!Number.isInteger(val) || val < 1 || val > 5) return null;
    parsed[item.id] = val;
  }
  return parsed;
}

export async function savePanasResponse(
  user: AuthContext,
  input: { sessionId: string; moment: PanasMoment; answers: unknown; consentAcceptedAt?: string },
): Promise<{ record?: PanasRecord; error?: string; status?: number }> {
  const sessionId = input.sessionId.trim().slice(0, 80);
  if (!sessionId) return { error: "Identificador de sessão inválido.", status: 400 };
  if (input.moment !== "before" && input.moment !== "after") {
    return { error: "Momento inválido (use before ou after).", status: 400 };
  }

  const answers = normalizeAnswers(input.answers);
  if (!answers) {
    return { error: "Responda todos os 20 itens do PANAS com valores de 1 a 5.", status: 400 };
  }

  const score = scorePanas(answers);
  if (!score) return { error: "Não foi possível calcular as notas do PANAS.", status: 400 };

  const consentAt = input.consentAcceptedAt || user.acceptedHealthDataAt || new Date().toISOString();
  const supabase = getSupabaseAdmin();

  if (!user.acceptedHealthDataAt) {
    await supabase.from("profiles").update({ accepted_health_data_at: consentAt }).eq("id", user.id);
  }

  const { data, error } = await supabase
    .from("survey_responses")
    .upsert(
      {
        user_id: user.id,
        anonymous_code: user.anonymousCode,
        instrument: "PANAS",
        session_id: sessionId,
        moment: input.moment,
        answers,
        score_positive: score.positive,
        score_negative: score.negative,
        consent_accepted_at: consentAt,
      },
      { onConflict: "user_id,instrument,session_id,moment" },
    )
    .select("session_id, moment, answers, score_positive, score_negative, created_at")
    .single();

  if (error || !data) return { error: error?.message ?? "Falha ao salvar questionário.", status: 500 };

  return {
    record: {
      sessionId: String(data.session_id),
      moment: data.moment as PanasMoment,
      answers,
      positive: Number(data.score_positive),
      negative: Number(data.score_negative),
      answeredAt: String(data.created_at),
    },
  };
}

export async function listMyPanasResponses(userId: string): Promise<PanasRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("survey_responses")
    .select("session_id, moment, answers, score_positive, score_negative, created_at")
    .eq("user_id", userId)
    .eq("instrument", "PANAS")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    sessionId: String(row.session_id),
    moment: row.moment as PanasMoment,
    answers: (row.answers as PanasAnswers) ?? {},
    positive: Number(row.score_positive ?? 0),
    negative: Number(row.score_negative ?? 0),
    answeredAt: String(row.created_at),
  }));
}

function avg(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const total = numbers.reduce((sum, n) => sum + n, 0);
  return Number((total / numbers.length).toFixed(2));
}

export async function listAdminSurveys(): Promise<AdminSurveySummary> {
  const supabase = getSupabaseAdmin();
  // Nunca seleciona user_id, nome ou e-mail para manter anonimização na área de pesquisa
  const { data, error } = await supabase
    .from("survey_responses")
    .select("id, anonymous_code, instrument, session_id, moment, answers, score_positive, score_negative, score_total, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows: AdminSurveyRow[] = ((data ?? []) as SurveyRow[]).map(row => ({
    id: row.id,
    anonymousCode: row.anonymous_code,
    instrument: row.instrument,
    sessionId: row.session_id,
    moment: row.moment,
    answers: row.answers ?? {},
    scorePositive: row.score_positive,
    scoreNegative: row.score_negative,
    scoreTotal: row.score_total,
    createdAt: row.created_at,
  }));

  const panasRows = rows.filter(r => r.instrument === "PANAS");
  const before = panasRows.filter(r => r.moment === "before");
  const after = panasRows.filter(r => r.moment === "after");

  const sessionMoments = new Map<string, Set<string>>();
  for (const r of panasRows) {
    const key = `${r.anonymousCode}:${r.sessionId}`;
    const set = sessionMoments.get(key) ?? new Set<string>();
    set.add(r.moment);
    sessionMoments.set(key, set);
  }
  const completedSessions = [...sessionMoments.values()].filter(s => s.has("before") && s.has("after")).length;

  return {
    totalResponses: panasRows.length,
    completedSessions,
    avgPositiveBefore: avg(before.flatMap(r => (r.scorePositive !== null ? [r.scorePositive] : []))),
    avgPositiveAfter: avg(after.flatMap(r => (r.scorePositive !== null ? [r.scorePositive] : []))),
    avgNegativeBefore: avg(before.flatMap(r => (r.scoreNegative !== null ? [r.scoreNegative] : []))),
    avgNegativeAfter: avg(after.flatMap(r => (r.scoreNegative !== null ? [r.scoreNegative] : []))),
    rows,
  };
}

export function buildAnonymizedSurveysCsv(rows: AdminSurveyRow[]): string {
  const panasRows = rows.filter(r => r.instrument === "PANAS");
  const header = [
    "codigo_participante",
    "sessao",
    "momento",
    "data",
    ...PANAS_ITEMS.map(item => `item_${item.id}_${item.label.toLowerCase()}`),
    "afeto_positivo",
    "afeto_negativo",
  ];

  const lines = panasRows.map(record =>
    [
      csvCell(record.anonymousCode),
      csvCell(record.sessionId),
      csvCell(record.moment === "before" ? "antes" : "depois"),
      csvCell(record.createdAt),
      ...PANAS_ITEMS.map(item => csvCell(record.answers[String(item.id)] ?? "")),
      csvCell(record.scorePositive ?? ""),
      csvCell(record.scoreNegative ?? ""),
    ].join(","),
  );

  return [header.join(","), ...lines].join("\n");
}
