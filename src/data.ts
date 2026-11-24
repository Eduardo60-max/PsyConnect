import type { Category, Professional } from "./types";

export const categories: Category[] = [
  { id: "ansiedade", label: "Ansiedade", accent: "#8b5cf6" },
  { id: "autoconhecimento", label: "Autoconhecimento", accent: "#0f766e" },
  { id: "relacionamentos", label: "Relacionamentos", accent: "#db2777" },
  { id: "sono", label: "Sono", accent: "#f59e0b" },
  { id: "emagrecimento", label: "Emagrecimento", accent: "#16a34a" },
  { id: "exercicio", label: "Exercício físico", accent: "#2563eb" },
];

// Temporário: some quando os profissionais passarem a vir do banco (próxima parte)
export const professionals: Professional[] = [
  {
    id: "prof-1",
    name: "Dra. Camila Nogueira",
    role: "Psicóloga clínica",
    specialty: "Ansiedade e burnout",
    accent: "#7c3aed",
  },
  {
    id: "prof-2",
    name: "Dr. João Pereira",
    role: "Psicoterapeuta",
    specialty: "Relacionamentos",
    accent: "#0f766e",
  },
  {
    id: "prof-3",
    name: "Dra. Lívia Andrade",
    role: "Neuropsicóloga",
    specialty: "Autoconhecimento",
    accent: "#be123c",
  },
  {
    id: "prof-4",
    name: "Dr. Rafael Souza",
    role: "Educador físico",
    specialty: "Treinos e desafios",
    accent: "#2563eb",
  },
  {
    id: "prof-5",
    name: "Dra. Beatriz Lima",
    role: "Nutricionista",
    specialty: "Emagrecimento saudável",
    accent: "#16a34a",
  },
];