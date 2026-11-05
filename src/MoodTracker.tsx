import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import type { MoodDay } from "./types";
import { fetchMoodWeek, saveMoodRequest } from "./api";

type MoodTrackerProps = {
  email: string;
};

const MOODS = [
  { value: 1, emoji: "😞", label: "Muito mal" },
  { value: 2, emoji: "😕", label: "Mal" },
  { value: 3, emoji: "😐", label: "Mais ou menos" },
  { value: 4, emoji: "🙂", label: "Bem" },
  { value: 5, emoji: "😄", label: "Muito bem" },
] as const;

function weekdayLabel(day: string) {
  return new Date(`${day}T12:00:00`)
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
}

export function MoodTracker({ email }: Readonly<MoodTrackerProps>) {
  const [week, setWeek] = useState<MoodDay[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNow, setSavedNow] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");
    fetchMoodWeek(email)
      .then(days => {
        if (cancelled) return;
        setWeek(days);
        const today = days.at(-1);
        setSelected(today?.mood ?? null);
        setNote(today?.note ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o diário agora.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const average = useMemo(() => {
    const values = week.flatMap(day => (day.mood === null ? [] : [day.mood]));
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [week]);

  const averageMood = average === null ? null : MOODS[Math.round(average) - 1];
  const hasToday = week.at(-1)?.mood != null;

  const handleSave = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (selected === null || isSaving) return;
    setIsSaving(true);
    setError("");
    setSavedNow(false);
    try {
      const days = await saveMoodRequest(email, selected, note.trim());
      setWeek(days);
      setSavedNow(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="insight-card mood-card">
      <p className="eyebrow">Diário de humor</p>
      <h3>Como você está hoje?</h3>

      <form onSubmit={handleSave}>
        <div className="mood-options" role="radiogroup" aria-label="Seu humor hoje">
          {MOODS.map(mood => (
            <button
              key={mood.value}
              type="button"
              role="radio"
              aria-checked={selected === mood.value}
              aria-label={mood.label}
              title={mood.label}
              className={selected === mood.value ? "mood-option active" : "mood-option"}
              onClick={() => {
                setSelected(mood.value);
                setSavedNow(false);
              }}
            >
              {mood.emoji}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="mood-note"
          value={note}
          onChange={event => {
            setNote(event.target.value);
            setSavedNow(false);
          }}
          placeholder="O que influenciou? (opcional)"
          maxLength={280}
          aria-label="Nota sobre o seu dia"
        />

        {selected !== null && selected <= 2 && (
          <p className="mood-support">
            Se estiver pesado, você não precisa passar por isso sozinho(a). O CVV atende pelo <strong>188</strong>, 24h.
          </p>
        )}

        <button type="submit" className="primary-btn full-width" disabled={selected === null || isSaving}>
          {isSaving ? "Salvando..." : hasToday ? "Atualizar registro de hoje" : "Registrar humor"}
        </button>
      </form>

      {savedNow && <p className="mood-saved">Registro salvo. Obrigado por se cuidar hoje. 💜</p>}
      {error && <p className="field-error">{error}</p>}

      <div className="mood-chart-header">
        <strong>Últimos 7 dias</strong>
        {averageMood && (
          <span>
            Média: {averageMood.emoji} {(average ?? 0).toFixed(1).replace(".", ",")}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="comments-empty">Carregando...</p>
      ) : (
        <div className="mood-chart" role="img" aria-label="Gráfico do humor nos últimos 7 dias">
          {week.map(day => {
            const mood = day.mood === null ? null : MOODS[day.mood - 1];
            return (
              <div key={day.day} className="mood-bar-col" title={mood ? `${mood.label}${day.note ? `: ${day.note}` : ""}` : "Sem registro"}>
                <div className="mood-bar-track">
                  {mood && (
                    <div className={`mood-bar mood-${day.mood}`} style={{ height: `${(day.mood ?? 0) * 20}%` }}>
                      <span>{mood.emoji}</span>
                    </div>
                  )}
                </div>
                <span className="mood-bar-label">{weekdayLabel(day.day)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}