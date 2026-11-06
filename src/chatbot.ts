type Topic = { words: string[]; replies: string[] };

type Persona = {
  topics: Topic[];
  generic: string[];
};

const CRISIS_WORDS = [
  "suicid",
  "me matar",
  "morrer",
  "acabar com tudo",
  "nao aguento mais",
  "sem saida",
  "me machucar",
  "automutil",
];

const CRISIS_REPLY =
  "Sinto muito que você esteja passando por isso, e fico feliz que tenha me contado. Você não precisa enfrentar isso sozinho(a). Ligue agora para o CVV: 188 (24h, gratuito) ou, em emergência, para o SAMU: 192. Se puder, avise alguém de confiança que esteja perto de você. Eu continuo aqui para conversar.";

const COMMON: Topic[] = [
  {
    words: ["oi", "ola", "bom dia", "boa tarde", "boa noite", "e ai"],
    replies: [
      "Olá! Que bom ter você por aqui. Como você está se sentindo hoje?",
      "Oi! Fico feliz com a sua mensagem. Me conta, como foi o seu dia até agora?",
    ],
  },
  {
    words: ["obrigad", "valeu", "grato", "grata", "agradec"],
    replies: [
      "Por nada! Estou aqui sempre que precisar. Cuide-se com carinho.",
      "Fico muito feliz em ajudar. Lembre que um passo de cada vez já é progresso.",
    ],
  },
  {
    words: ["sessao", "consulta", "agendar", "horario", "marcar"],
    replies: [
      "Para conversarmos com mais calma, você pode reservar uma sessão na aba Agendamento. Escolha o horário que ficar melhor para você.",
      "Vamos marcar sim! Na aba Agendamento você escolhe o dia e o horário e já deixa o motivo da sessão.",
    ],
  },
  {
    words: ["grupo", "comunidade"],
    replies: [
      "Os grupos são ótimos para trocar experiências. Que tal se apresentar no mural e ver como as outras pessoas estão lidando com isso?",
    ],
  },
  {
    words: ["tchau", "ate mais", "ate logo", "falou"],
    replies: ["Até mais! Qualquer coisa, é só me chamar por aqui. 💜"],
  },
];

const PERSONAS: Record<number, Persona> = {
  // Dra. Camila Nogueira: ansiedade e burnout
  1: {
    topics: [
      {
        words: ["ansios", "ansied", "nervos", "panico", "preocup", "angust", "coracao acelerado"],
        replies: [
          "Entendo, a ansiedade pode ser bem cansativa. Uma técnica que ajuda é o 5-4-3-2-1: nomeie 5 coisas que você vê, 4 que toca, 3 que ouve, 2 que cheira e 1 que saboreia. Isso traz a atenção de volta para o agora.",
          "Quando a ansiedade aperta, tente a respiração 4-7-8: inspire por 4 segundos, segure por 7 e solte por 8. Tem um exercício guiado na página inicial do app, vale experimentar.",
          "Obrigada por compartilhar isso. Perceber a ansiedade já é um passo importante. O que costuma acontecer logo antes dela aparecer?",
        ],
      },
      {
        words: ["sono", "dormir", "insonia", "acordo", "cansad"],
        replies: [
          "O sono e a ansiedade andam juntos. Experimente desligar telas 1 hora antes de dormir e manter um horário parecido todos os dias. Você pode conhecer o grupo Noites Mais Leves também.",
          "Quando a mente não desacelera à noite, ajuda anotar o que está te preocupando num papel antes de deitar. Assim a cabeça entende que aquilo já está guardado.",
        ],
      },
      {
        words: ["trabalho", "prazo", "estress", "burnout", "sobrecarreg", "esgot", "pressao"],
        replies: [
          "Parece que você está carregando muita coisa. Que tal listar as 3 prioridades de hoje e deixar o resto para depois? Pausas curtas ao longo do dia também protegem a sua energia.",
          "Esgotamento é um sinal do corpo, não fraqueza. Dá para começar com pequenos limites: um horário para parar de responder mensagens de trabalho, por exemplo.",
        ],
      },
      {
        words: ["triste", "choro", "sozinho", "sozinha", "vazio", "desanim"],
        replies: [
          "Sinto muito que esteja assim. Seus sentimentos importam, e não precisa passar por isso sozinho(a). Quer me contar um pouco mais sobre o que tem pesado?",
        ],
      },
    ],
    generic: [
      "Obrigada por me contar. Como isso tem afetado o seu dia a dia?",
      "Entendo. E o que você sente no corpo quando pensa nisso?",
      "Estou aqui com você. Vamos com calma: o que você gostaria de trabalhar primeiro?",
      "Isso faz sentido. Um passo de cada vez já é progresso. O que seria pequeno e possível para hoje?",
    ],
  },

  // Dr. João Pereira: relacionamentos
  2: {
    topics: [
      {
        words: ["brig", "discuss", "conflito", "ciume", "parceir", "namor", "casal", "casamento"],
        replies: [
          "Conflitos fazem parte, o importante é como conversamos sobre eles. Tente começar com 'eu me sinto...' em vez de 'você sempre...'. Isso diminui a defesa do outro.",
          "Antes de responder numa discussão, vale respirar fundo e perguntar a si mesmo: o que eu quero que o outro entenda? Isso costuma mudar o tom da conversa.",
        ],
      },
      {
        words: ["limite", "dizer nao", "nao consigo negar", "abus", "folgad"],
        replies: [
          "Limites são uma forma de cuidado, com você e com a relação. Comece pequeno: diga 'preciso pensar e te respondo depois'. Isso já cria espaço para escolher.",
          "Dizer não não é frieza. Podemos treinar frases simples e firmes, como 'hoje não consigo, mas obrigado por lembrar de mim'.",
        ],
      },
      {
        words: ["familia", "mae", "pai", "irmao", "irma", "amigo", "amiga"],
        replies: [
          "As relações familiares são das mais intensas. O que você gostaria que fosse diferente nessa relação? Às vezes nomear isso já alivia.",
        ],
      },
      {
        words: ["autoestima", "inseguran", "nao sou bom", "nao sou boa", "comparo", "sozinho", "sozinha"],
        replies: [
          "Muitas vezes somos mais duros com nós mesmos do que seríamos com um amigo. Se um amigo te contasse isso, o que você diria a ele?",
          "A autoestima se constrói em pequenos gestos de respeito por si. Qual foi algo que você fez esta semana que te deixou orgulhoso(a), por menor que seja?",
        ],
      },
    ],
    generic: [
      "Obrigado por confiar isso a mim. Como você se sentiu nessa situação?",
      "Entendo. E o que você gostaria que acontecesse daqui para frente?",
      "Isso parece importante para você. Quer me contar mais detalhes?",
      "Estou ouvindo. O que você acha que a outra pessoa sentiu nessa situação?",
    ],
  },

  // Dra. Beatriz Lima: alimentação saudável
  3: {
    topics: [
      {
        words: ["nao como", "passar fome", "jejum", "vomit", "culpa por comer", "culpa de comer", "compulsao", "compulsiv"],
        replies: [
          "Obrigada por confiar isso a mim. O que você descreve merece um acompanhamento cuidadoso, sem pressa e sem julgamento. Podemos conversar numa consulta, e um psicólogo do app também pode caminhar junto. Você não precisa lidar com isso sozinho(a).",
        ],
      },
      {
        words: ["comida", "aliment", "dieta", "comer", "fome", "refeic", "cardapio"],
        replies: [
          "Uma boa base é montar o prato com cores variadas e comer devagar, prestando atenção na fome e na saciedade. Mudanças pequenas e constantes funcionam melhor do que regras rígidas.",
          "Em vez de cortar alimentos, tente acrescentar: uma fruta a mais por dia, uma salada no almoço. Aos poucos o resto se ajusta, e é isso que o desafio de reeducação alimentar propõe.",
        ],
      },
      {
        words: ["agua", "hidrat", "beber"],
        replies: [
          "Manter uma garrafinha por perto ajuda muito. Beber um copo ao acordar e outro antes de cada refeição já cria o hábito.",
        ],
      },
      {
        words: ["emagrec", "peso", "balanca", "barriga"],
        replies: [
          "Emagrecimento saudável é gradual e respeita o seu corpo. Mais do que um número, vale observar energia, sono e disposição. Podemos montar metas pequenas juntas, numa consulta.",
        ],
      },
      {
        words: ["ansiedade", "doce", "beliscar", "estress"],
        replies: [
          "Comer por ansiedade é muito comum, e não é falta de força de vontade. Quando bater a vontade, espere 10 minutos e respire antes de decidir. Muitas vezes ela passa ou muda de intensidade.",
        ],
      },
      {
        words: ["treino", "exercicio", "academia", "caminhada", "movimento"],
        replies: [
          "Movimento e alimentação se ajudam. Comece com 10 minutos de caminhada por dia e aumente aos poucos. O Desafio 21 Dias de Movimento é um bom ponto de partida.",
        ],
      },
    ],
    generic: [
      "Obrigada por compartilhar. Como têm sido as suas refeições ao longo do dia?",
      "Entendi. O que você gostaria de melhorar primeiro na sua rotina de alimentação?",
      "Vamos com calma, sem cobranças. O que seria um pequeno passo possível para esta semana?",
      "Faz sentido. E como você tem se sentido em relação à comida ultimamente?",
    ],
  },
};

const FALLBACK: Persona = {
  topics: [],
  generic: [
    "Obrigado(a) pela mensagem! Vou ler com atenção e te respondo com calma.",
    "Entendi. Quer me contar um pouco mais sobre isso?",
  ],
};

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "");
}

function matches(norm: string, tokens: Set<string>, word: string) {
  // Palavras curtas ("oi", "e ai") só valem como palavra inteira, para não casar com "coisa", "foi"...
  if (word.length <= 3) return tokens.has(word);
  return norm.includes(word);
}

function choose(pool: string[], recent: string[]) {
  const fresh = pool.filter(reply => !recent.includes(reply));
  const options = fresh.length > 0 ? fresh : pool;
  return options[Math.floor(Math.random() * options.length)] ?? "";
}

export function pickReply(conversationId: number, text: string, recent: string[]): string {
  const norm = normalize(text);
  const tokens = new Set(norm.split(/[^a-z0-9]+/).filter(Boolean));

  if (CRISIS_WORDS.some(word => norm.includes(word))) return CRISIS_REPLY;

  const persona = PERSONAS[conversationId] ?? FALLBACK;

  for (const topic of [...persona.topics, ...COMMON]) {
    if (topic.words.some(word => matches(norm, tokens, word))) {
      return choose(topic.replies, recent);
    }
  }

  return choose(persona.generic, recent);
}

// Entre 1,4 s e 3,2 s, um pouco maior para mensagens longas
export function replyDelayMs(text: string): number {
  return 1400 + Math.min(text.length * 20, 1200) + Math.floor(Math.random() * 600);
}