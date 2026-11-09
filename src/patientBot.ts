const THANKS = ["obrigad", "valeu", "agradec"];

const BYE = ["tchau", "ate mais", "ate logo"];

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "");
}

function choose(pool: string[], recent: string[]) {
  const fresh = pool.filter(reply => !recent.includes(reply));
  const options = fresh.length > 0 ? fresh : pool;
  return options[Math.floor(Math.random() * options.length)] ?? "";
}

type Topic = { words: string[]; replies: string[] };

const TOPICS: Topic[] = [
  {
    words: ["respira", "exercicio", "tecnica", "pratica"],
    replies: [
      "Vou tentar essa técnica hoje à noite, doutor(a). Obrigado(a) pela dica!",
      "Já comecei a praticar e senti a diferença logo nos primeiros minutos.",
    ],
  },
  {
    words: ["sessao", "consulta", "horario", "agendar", "marcar", "proxima"],
    replies: [
      "Combinado! Já deixei o horário reservado na minha agenda.",
      "Perfeito, vou chegar com antecedência. Obrigado(a) por avisar!",
    ],
  },
  {
    words: ["como voce", "como esta", "como foi", "como se sente", "como tem"],
    replies: [
      "Estou melhor do que na semana passada, mas ainda tenho dias mais difíceis.",
      "Hoje foi um dia mais tranquilo. Estou tentando ir com calma, um passo de cada vez.",
      "Cansado(a), mas com esperança. Conversar ajuda bastante.",
    ],
  },
  {
    words: ["sono", "dormir", "noite"],
    replies: [
      "Tenho conseguido dormir um pouco melhor, mas ainda acordo no meio da madrugada.",
      "Reduzi o celular antes de deitar e senti que ajudou.",
    ],
  },
  {
    words: ["trabalho", "reuniao", "chefe", "prazo"],
    replies: [
      "O trabalho continua puxado, mas estou tentando respeitar meus limites.",
      "Hoje consegui priorizar só o essencial e me senti menos sobrecarregado(a).",
    ],
  },
  {
    words: ["parabens", "orgulho", "otimo", "que bom"],
    replies: [
      "Muito obrigado(a)! Ouvir isso me motiva a continuar.",
      "Fico feliz em saber que estou no caminho certo.",
    ],
  },
];

const GENERIC = [
  "Entendi, doutor(a). Faz bastante sentido o que você disse.",
  "Obrigado(a) por me orientar. Vou refletir sobre isso.",
  "Concordo. Posso comentar mais sobre isso na nossa próxima conversa?",
  "Isso me ajuda bastante. Vou tentar colocar em prática.",
];

export function pickPatientReply(text: string, recent: string[]): string {
  const norm = normalize(text);

  if (THANKS.some(word => norm.includes(word))) {
    return choose(["Eu que agradeço pela atenção! 💜", "Obrigado(a) a você, de coração."], recent);
  }
  if (BYE.some(word => norm.includes(word))) {
    return choose(["Até mais! Qualquer coisa eu te escrevo por aqui.", "Tchau! Cuide-se também."], recent);
  }

  for (const topic of TOPICS) {
    if (topic.words.some(word => norm.includes(word))) return choose(topic.replies, recent);
  }
  return choose(GENERIC, recent);
}