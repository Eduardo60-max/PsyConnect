import { Database } from "bun:sqlite";

const db = new Database("psyconect.sqlite", { create: true });
db.exec("PRAGMA journal_mode = WAL;");

db.run(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expertId INTEGER NOT NULL,
    expertName TEXT NOT NULL,
    expertRole TEXT NOT NULL,
    specialty TEXT NOT NULL,
    price TEXT NOT NULL,
    accent TEXT NOT NULL,
    slot TEXT NOT NULL,
    preference TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )
`);

export const BOOKING_SLOTS = ["Hoje • 16:00", "Hoje • 18:30", "Amanhã • 09:30", "Quarta • 14:00"];
const PREFERENCES = ["Online", "Presencial"];

export type DbBooking = {
  id: string;
  expertId: number;
  expertName: string;
  expertRole: string;
  specialty: string;
  price: string;
  accent: string;
  slot: string;
  preference: string;
  reason: string;
  status: string;
  createdAt: number;
};

export type NewBooking = Omit<DbBooking, "id" | "status" | "createdAt"> & { email: string };

export type BookingFailure = { error: string; status: number };

const COLUMNS =
  "id, expertId, expertName, expertRole, specialty, price, accent, slot, preference, reason, status, createdAt";

// Próximas primeiro (na ordem dos horários); canceladas por último
export function listBookings(email: string): DbBooking[] {
  const rows = db.query(`SELECT ${COLUMNS} FROM bookings WHERE email = $email`).all({ $email: email }) as DbBooking[];
  return rows.sort((a, b) => {
    const aCanceled = a.status === "canceled" ? 1 : 0;
    const bCanceled = b.status === "canceled" ? 1 : 0;
    return (
      aCanceled - bCanceled ||
      BOOKING_SLOTS.indexOf(a.slot) - BOOKING_SLOTS.indexOf(b.slot) ||
      a.createdAt - b.createdAt
    );
  });
}

function findOwned(email: string, id: string): (DbBooking & { email: string }) | null {
  return db
    .query(`SELECT ${COLUMNS}, email FROM bookings WHERE id = $id AND email = $email`)
    .get({ $id: id, $email: email }) as (DbBooking & { email: string }) | null;
}

function hasConflict(email: string, expertId: number, slot: string, excludeId = ""): boolean {
  const row = db
    .query(
      `SELECT 1 FROM bookings
       WHERE email = $email AND expertId = $expertId AND slot = $slot AND status != 'canceled' AND id != $excludeId`,
    )
    .get({ $email: email, $expertId: expertId, $slot: slot, $excludeId: excludeId });
  return Boolean(row);
}

export function createBooking(input: NewBooking): BookingFailure | null {
  if (!BOOKING_SLOTS.includes(input.slot)) return { error: "Horário inválido.", status: 400 };
  if (!PREFERENCES.includes(input.preference)) return { error: "Preferência inválida.", status: 400 };
  if (hasConflict(input.email, input.expertId, input.slot)) {
    return { error: "Você já tem uma sessão com este profissional neste horário.", status: 409 };
  }

  db.prepare(
    `INSERT INTO bookings (id, email, expertId, expertName, expertRole, specialty, price, accent, slot, preference, reason, status, createdAt)
     VALUES ($id, $email, $expertId, $expertName, $expertRole, $specialty, $price, $accent, $slot, $preference, $reason, 'confirmed', $createdAt)`,
  ).run({
    $id: `booking-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    $email: input.email,
    $expertId: input.expertId,
    $expertName: input.expertName,
    $expertRole: input.expertRole,
    $specialty: input.specialty,
    $price: input.price,
    $accent: input.accent,
    $slot: input.slot,
    $preference: input.preference,
    $reason: input.reason,
    $createdAt: Date.now(),
  });
  return null;
}

export function cancelBooking(email: string, id: string): BookingFailure | null {
  const booking = findOwned(email, id);
  if (!booking) return { error: "Sessão não encontrada.", status: 404 };
  if (booking.status === "canceled") return { error: "Esta sessão já foi cancelada.", status: 400 };

  db.prepare("UPDATE bookings SET status = 'canceled' WHERE id = $id").run({ $id: id });
  return null;
}

export function rescheduleBooking(email: string, id: string, slot: string): BookingFailure | null {
  if (!BOOKING_SLOTS.includes(slot)) return { error: "Horário inválido.", status: 400 };

  const booking = findOwned(email, id);
  if (!booking) return { error: "Sessão não encontrada.", status: 404 };
  if (booking.status === "canceled") return { error: "Não é possível remarcar uma sessão cancelada.", status: 400 };
  if (booking.slot === slot) return { error: "Escolha um horário diferente do atual.", status: 400 };
  if (hasConflict(email, booking.expertId, slot, id)) {
    return { error: "Você já tem uma sessão com este profissional neste horário.", status: 409 };
  }

  db.prepare("UPDATE bookings SET slot = $slot, status = 'rescheduled' WHERE id = $id").run({ $slot: slot, $id: id });
  return null;
}

// Usado pelo "Modo demonstração"
export function resetBookings() {
  db.run("DELETE FROM bookings");
}