import type { Booking, Conversation } from "./types";
import type { NewNotification } from "./notifications";

export type ProArrival = {
  conversationId: number;
  name: string;
  text: string;
  messageCount: number;
};

function fromOthers(conversation: Conversation) {
  return conversation.messages.filter(message => message.sender === "them");
}

// Respostas do profissional que chegaram desde a última leitura
export function newProMessages(previous: Conversation[], next: Conversation[]): ProArrival[] {
  const arrivals: ProArrival[] = [];

  for (const conversation of next) {
    const before = previous.find(item => item.id === conversation.id);
    if (!before) continue;

    const beforeCount = fromOthers(before).length;
    const incoming = fromOthers(conversation);
    if (incoming.length <= beforeCount) continue;

    arrivals.push({
      conversationId: conversation.id,
      name: conversation.name,
      text: incoming.at(-1)?.text ?? "Nova mensagem",
      messageCount: incoming.length,
    });
  }

  return arrivals;
}

// Sessões que o profissional cancelou ou remarcou
export function diffBookings(previous: Booking[], next: Booking[]): NewNotification[] {
  const changes: NewNotification[] = [];

  for (const booking of next) {
    const before = previous.find(item => item.id === booking.id);
    if (!before) continue;

    if (before.status !== "canceled" && booking.status === "canceled") {
      changes.push({
        kind: "booking",
        key: `booking-${booking.id}-canceled`,
        title: "Sessão cancelada pelo profissional",
        body: `${booking.expertName} • ${booking.slot}`,
        target: { screen: "bookings" },
      });
    } else if (booking.status !== "canceled" && before.slot !== booking.slot) {
      changes.push({
        kind: "booking",
        key: `booking-${booking.id}-${booking.slot}`,
        title: "Sessão remarcada pelo profissional",
        body: `${booking.expertName} • novo horário: ${booking.slot}`,
        target: { screen: "bookings" },
      });
    }
  }

  return changes;
}