import type { MoodDay } from "./types";
import { getSupabaseAdmin } from "./supabaseServer";

function dayKey(date: Date): string {
  // en-CA gera AAAA-MM-DD
  return date.toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
}

export async function saveMood(userId: string, mood: number, note: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("mood_entries").upsert(
    {
      user_id: userId,
      day: dayKey(new Date()),
      mood,
      note: note.trim().slice(0, 280),
    },
    { onConflict: "user_id,day" },
  );
  if (error) throw new Error(error.message);
}

// Últimos 7 dias (do mais antigo para hoje). Dias sem registro vêm com mood null.
export async function listMoodWeek(userId: string): Promise<MoodDay[]> {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  }

  const from = days[0] ?? "";
  const to = days.at(-1) ?? "";

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mood_entries")
    .select("day, mood, note")
    .eq("user_id", userId)
    .gte("day", from)
    .lte("day", to);

  if (error) throw new Error(error.message);

  const byDay = new Map((data ?? []).map(row => [String(row.day), row]));
  return days.map(day => {
    const entry = byDay.get(day);
    return {
      day,
      mood: entry ? Number(entry.mood) : null,
      note: entry ? String(entry.note ?? "") : "",
    };
  });
}
