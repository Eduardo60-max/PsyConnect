import type { Category } from "./types";

export const categories: Category[] = [
  { id: "ansiedade", label: "Ansiedade", accent: "#8b5cf6" },
  { id: "autoconhecimento", label: "Autoconhecimento", accent: "#0f766e" },
  { id: "relacionamentos", label: "Relacionamentos", accent: "#db2777" },
  { id: "sono", label: "Sono", accent: "#f59e0b" },
  { id: "emagrecimento", label: "Emagrecimento", accent: "#16a34a" },
  { id: "exercicio", label: "Exercício físico", accent: "#2563eb" },
];

export const SPECIALTY_BY_THEME: Record<string, string> = {
  ansiedade: "Ansiedade e burnout",
  autoconhecimento: "Autoconhecimento",
  relacionamentos: "Relacionamentos",
  sono: "Sono",
  emagrecimento: "Emagrecimento saudável",
  exercicio: "Treinos e desafios",
};
