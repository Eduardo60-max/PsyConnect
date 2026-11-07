import { buildRanking, computeChallengeStats } from "./challengeStats";

type ChallengeStatsPanelProps = {
  groupId: string;
  total: number;
  accent: string;
  completedDays: number[];
  userName: string;
};

const PODIUM = ["🥇", "🥈", "🥉"];

export function ChallengeStatsPanel({
  groupId,
  total,
  accent,
  completedDays,
  userName,
}: Readonly<ChallengeStatsPanelProps>) {
  const stats = computeChallengeStats(completedDays, total);
  const firstName = userName.trim().split(/\s+/)[0] || "Você";
  const ranking = buildRanking(groupId, total, firstName, stats.done);
  const position = ranking.findIndex(entry => entry.isYou) + 1;

  return (
    <>
      {stats.finished && (
        <output className="welcome-banner">
          <div>
            <strong>Desafio concluído! 🏆</strong>
            <p>Parabéns por chegar até o fim. Cada dia contou.</p>
          </div>
        </output>
      )}

      <div className="stats-grid">
        <div className="stat-tile">
          <strong>
            {stats.done}/{stats.total}
          </strong>
          <span>dias concluídos</span>
        </div>
        <div className="stat-tile">
          <strong>🔥 {stats.currentStreak}</strong>
          <span>sequência atual</span>
        </div>
        <div className="stat-tile">
          <strong>{stats.bestStreak}</strong>
          <span>melhor sequência</span>
        </div>
        <div className="stat-tile">
          <strong>{stats.percent}%</strong>
          <span>do desafio</span>
        </div>
      </div>

      <div className="insight-card">
        <h3>Medalhas</h3>
        <div className="medals-grid">
          {stats.medals.map(medal => (
            <div key={medal.id} className={medal.unlocked ? "medal unlocked" : "medal"}>
              <span className="medal-emoji" aria-hidden="true">
                {medal.unlocked ? medal.emoji : "🔒"}
              </span>
              <strong>{medal.title}</strong>
              <small>{medal.description}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="insight-card">
        <h3>Ranking de participação</h3>
        <p className="ranking-note">
          Você está em {position}º lugar. Os outros participantes são simulados nesta demonstração.
        </p>
        <ol className="ranking-list">
          {ranking.map((entry, index) => {
            const percent = total > 0 ? Math.round((entry.done / total) * 100) : 0;
            return (
              <li key={entry.name} className={entry.isYou ? "ranking-item you" : "ranking-item"}>
                <span className="ranking-pos">{PODIUM[index] ?? `${index + 1}º`}</span>
                <span className="ranking-name">
                  {entry.name}
                  {entry.isYou ? " (você)" : ""}
                </span>
                <div className="progress-bar-track ranking-bar">
                  <div className="progress-bar-fill" style={{ width: `${percent}%`, backgroundColor: accent }} />
                </div>
                <span className="ranking-score">
                  {entry.done}/{total}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}