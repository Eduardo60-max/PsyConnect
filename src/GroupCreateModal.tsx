import { useState, type FormEvent } from "react";
import type { Category, Professional } from "./types";

type GroupCreateModalProps = {
  categories: Category[];
  professionals: Professional[];
  onCreate: (input: {
    name: string;
    description: string;
    theme: string;
    adminId?: string | null;
    isTemporary: boolean;
    durationDays?: number;
    accent: string;
  }) => Promise<void> | void;
  onClose: () => void;
};

const accentOptions = ["#8b5cf6", "#0f766e", "#db2777", "#f59e0b", "#16a34a", "#2563eb", "#be123c"];

export function GroupCreateModal({ categories, professionals, onCreate, onClose }: Readonly<GroupCreateModalProps>) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState(categories[0]?.id ?? "");
  const [adminId, setAdminId] = useState(professionals[0]?.id ?? "");
  const [isTemporary, setIsTemporary] = useState(false);
  const [durationDays, setDurationDays] = useState(5);
  const [accent, setAccent] = useState<string>(accentOptions[0]!);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim() || busy) return;

    setBusy(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        theme,
        adminId: adminId || null,
        isTemporary,
        durationDays: isTemporary ? durationDays : undefined,
        accent,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Criar novo grupo" onClick={onClose}>
      <div className="modal-card" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Nova comunidade</p>
            <h3>Criar grupo</h3>
          </div>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="booking-form">
          <label>
            Nome do grupo
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Ex: Manhãs Mais Calmas"
              maxLength={80}
              required
            />
          </label>

          <label>
            Descrição
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Conte em poucas palavras o objetivo do grupo"
              rows={3}
              maxLength={400}
              required
            />
          </label>

          <label>
            Tema
            <select value={theme} onChange={event => setTheme(event.target.value)}>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Profissional responsável (opcional)
            <select value={adminId} onChange={event => setAdminId(event.target.value)}>
              <option value="">Comunidade aberta</option>
              {professionals.map(professional => (
                <option key={professional.id} value={professional.id}>
                  {professional.name} · {professional.specialty}
                </option>
              ))}
            </select>
          </label>

          <label className="create-group-toggle-row">
            <span>Grupo temporário (desafio com duração definida)</span>
            <input
              type="checkbox"
              checked={isTemporary}
              onChange={event => setIsTemporary(event.target.checked)}
            />
          </label>

          {isTemporary && (
            <label>
              Duração (em dias)
              <input
                type="number"
                min={1}
                max={90}
                value={durationDays}
                onChange={event => setDurationDays(Number(event.target.value) || 1)}
              />
            </label>
          )}

          <div>
            <span className="create-group-accent-label">Cor do grupo</span>
            <div className="accent-picker">
              {accentOptions.map(option => (
                <button
                  key={option}
                  type="button"
                  className={option === accent ? "accent-swatch active" : "accent-swatch"}
                  style={{ backgroundColor: option }}
                  aria-label={`Selecionar cor ${option}`}
                  onClick={() => setAccent(option)}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="primary-btn full-width" disabled={busy}>
            {busy ? "Criando..." : "Criar grupo"}
          </button>
        </form>
      </div>
    </div>
  );
}
