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

export type RankEntry = {
  name: string;
  done: number;
  isYou: boolean;
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
  // "run" termina valendo a sequência que contém o último dia concluído

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

// Medalhas que estavam bloqueadas e passaram a estar desbloqueadas
export function newlyUnlocked(before: ChallengeStatsData, after: ChallengeStatsData): Medal[] {
  return after.medals.filter((medal, index) => medal.unlocked && !before.medals[index]?.unlocked);
}

const PEERS = ["Maya", "Léo", "Clara", "Ravi", "Bia"];

function hash(text: string) {
  let value = 0;
  for (let i = 0; i < text.length; i++) {
    value = (value * 31 + (text.codePointAt(i) ?? 0)) >>> 0;
  }
  return value;
}

// Ranking de demonstração: os outros participantes são simulados (valores estáveis por grupo)
export function buildRanking(groupId: string, total: number, youName: string, youDone: number): RankEntry[] {
  const peers: RankEntry[] = PEERS.map(name => ({
    name,
    done: hash(`${groupId}-${name}`) % (total + 1),
    isYou: false,
  }));

  return [...peers, { name: youName, done: youDone, isYou: true }].sort(
    (a, b) => b.done - a.done || Number(b.isYou) - Number(a.isYou),
  );
}