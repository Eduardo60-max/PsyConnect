const COLORS = ["#7c3aed", "#0f766e", "#be123c", "#2563eb", "#16a34a", "#f59e0b"];

export function colorFor(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + (text.codePointAt(i) ?? 0)) >>> 0;
  }
  return COLORS[hash % COLORS.length] ?? "#4f46e5";
}