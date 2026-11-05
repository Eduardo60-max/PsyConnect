import { Database } from "bun:sqlite";

const db = new Database("psyconect.sqlite", { create: true });
db.exec("PRAGMA journal_mode = WAL;");

db.run(`
  CREATE TABLE IF NOT EXISTS mood_entries (
    email TEXT NOT NULL,
    day TEXT NOT NULL,
    mood INTEGER NOT NULL,
    note TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    PRIMARY KEY (email, day)
  )
`);

export type MoodDay = {
  day: string;
  mood: number | null;
  note: string;
};

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) return null;
  return email;
}

function dayKey(date: Date): string {
  // en-CA gera AAAA-MM-DD
  return date.toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
}

export function saveMood(email: string, mood: number, note: string) {
  db.prepare(
    `INSERT INTO mood_entries (email, day, mood, note, createdAt)
     VALUES ($email, $day, $mood, $note, $createdAt)
     ON CONFLICT(email, day) DO UPDATE SET mood = excluded.mood, note = excluded.note, createdAt = excluded.createdAt`,
  ).run({
    $email: email,
    $day: dayKey(new Date()),
    $mood: mood,
    $note: note,
    $createdAt: Date.now(),
  });
}

// Últimos 7 dias (do mais antigo para hoje). Dias sem registro vêm com mood null.
export function listMoodWeek(email: string): MoodDay[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  }

  const from = days[0] ?? "";
  const to = days.at(-1) ?? "";

  const rows = db
    .query("SELECT day, mood, note FROM mood_entries WHERE email = $email AND day >= $from AND day <= $to")
    .all({ $email: email, $from: from, $to: to }) as { day: string; mood: number; note: string }[];

  const byDay = new Map(rows.map(row => [row.day, row]));
  return days.map(day => {
    const entry = byDay.get(day);
    return { day, mood: entry?.mood ?? null, note: entry?.note ?? "" };
  });
}