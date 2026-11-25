export function formatTimeLabel(input?: string | number | Date): string {
  const date = input === undefined ? new Date() : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bahia",
  });
}

export function handleFor(name: string): string {
  const cleaned = name.trim().replace(/^(dra?|profa?|sra?)\.?\s+/i, "");
  const first = cleaned.split(/\s+/)[0] || "voce";
  return `@${first.toLowerCase()}`;
}

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
