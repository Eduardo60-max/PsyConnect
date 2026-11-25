export type Medal = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
};

export type ChallengeStatsData = {
  done: number;
  total: number;
  percent: number;
  currentStreak: number;
  bestStreak: number;
  finished: boolean;
  medals: Medal[];
};

export function computeChallengeStats(completed: number[], total: number): ChallengeStatsData {
  const days = [...new Set(completed)].filter(day => day >= 1 && day <= total).sort((a, b) => a - b);

  let best = 0;
  let run = 0;
  let previous = 0;
  for (const day of days) {
    run = day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  const done = days.length;
  const finished = total > 0 && done === total;

  const medals: Medal[] = [
    { id: "first", emoji: "🥉", title: "Primeiro passo", description: "Concluiu o primeiro dia.", unlocked: done >= 1 },
    { id: "streak", emoji: "🔥", title: "Em ritmo", description: "3 dias seguidos concluídos.", unlocked: best >= 3 },
    {
      id: "half",
      emoji: "🥈",
      title: "Metade do caminho",
      description: "Chegou na metade do desafio.",
      unlocked: total > 0 && done >= Math.ceil(total / 2),
    },
    { id: "finish", emoji: "🏆", title: "Desafio concluído", description: "Concluiu todos os dias.", unlocked: finished },
  ];

  return {
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    currentStreak: run,
    bestStreak: best,
    finished,
    medals,
  };
}

export function newlyUnlocked(before: ChallengeStatsData, after: ChallengeStatsData): Medal[] {
  return after.medals.filter((medal, index) => medal.unlocked && !before.medals[index]?.unlocked);
}
