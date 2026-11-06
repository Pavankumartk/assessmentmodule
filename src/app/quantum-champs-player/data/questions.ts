
/* Quantum Champs - Central Dummy Question Data */

export type Team = "nova" | "blaze";

export type GameMode = "full" | "quick";

export type QuestionType = "mcq" | "hidden" | "drag-drop";

export type QuestionOption = {
  id: string;
  text: string;
  image?: string;
};

export type HiddenTile = {
  id: string;
  text: string;
  image?: string;
  isCorrect: boolean;
};

export type BaseQuestion = {
  id: string;
  team: Team;
  round: 1 | 2;
  questionNumber: number;
  type: QuestionType;
  question: string;
  xp: number;
  hint?: string;
  explanation?: string;
  image?: string;
};

export type MCQQuestion = BaseQuestion & {
  type: "mcq";
  options: QuestionOption[];
  correctAnswer: string;
};

export type HiddenQuestion = BaseQuestion & {
  type: "hidden";
  tiles: HiddenTile[];
  selectionLimit: number;
};

export type DragDropQuestion = BaseQuestion & {
  type: "drag-drop";
  steps: QuestionOption[];
  correctOrder: string[];
};

export type QuantumQuestion =
  | MCQQuestion
  | HiddenQuestion
  | DragDropQuestion;

/* --------------------------------------------------
   NOVA - ROUND 1
-------------------------------------------------- */

const novaRound1: QuantumQuestion[] = [
  {
    id: "nova-r1-q1",
    team: "nova",
    round: 1,
    questionNumber: 1,
    type: "mcq",
    question: "What does AI stand for?",
    xp: 1000,
    options: [
      { id: "a", text: "Automated Internet" },
      { id: "b", text: "Artificial Intelligence" },
      { id: "c", text: "Advanced Interface" },
      { id: "d", text: "Artificial Information" },
    ],
    correctAnswer: "b",
    hint: "Think about machines performing intelligent tasks.",
    explanation: "AI stands for Artificial Intelligence.",
  },
  {
    id: "nova-r1-q2",
    team: "nova",
    round: 1,
    questionNumber: 2,
    type: "mcq",
    question: "Which of these is an example of Artificial Intelligence?",
    xp: 1200,
    options: [
      { id: "a", text: "Wooden Chair" },
      { id: "b", text: "Notebook" },
      { id: "c", text: "Voice Assistant" },
      { id: "d", text: "Water Bottle" },
    ],
    correctAnswer: "c",
    hint: "It can understand and respond to spoken commands.",
    explanation: "Voice assistants use AI to interpret and respond to requests.",
  },
  {
    id: "nova-r1-q3",
    team: "nova",
    round: 1,
    questionNumber: 3,
    type: "mcq",
    question: "What is the main purpose of Machine Learning?",
    xp: 1400,
    options: [
      { id: "a", text: "To learn patterns from data" },
      { id: "b", text: "To manufacture computers" },
      { id: "c", text: "To connect electrical wires" },
      { id: "d", text: "To replace the internet" },
    ],
    correctAnswer: "a",
    hint: "Machine Learning uses data to improve predictions.",
    explanation: "Machine Learning allows systems to learn patterns from data.",
  },
];

/* --------------------------------------------------
   BLAZE - ROUND 1
-------------------------------------------------- */

const blazeRound1: QuantumQuestion[] = [
  {
    id: "blaze-r1-q1",
    team: "blaze",
    round: 1,
    questionNumber: 1,
    type: "mcq",
    question: "Which technology allows computers to understand human language?",
    xp: 1000,
    options: [
      { id: "a", text: "Computer Graphics" },
      { id: "b", text: "Natural Language Processing" },
      { id: "c", text: "Cloud Storage" },
      { id: "d", text: "Bluetooth" },
    ],
    correctAnswer: "b",
    hint: "It is commonly abbreviated as NLP.",
    explanation: "Natural Language Processing helps computers process human language.",
  },
  {
    id: "blaze-r1-q2",
    team: "blaze",
    round: 1,
    questionNumber: 2,
    type: "mcq",
    question: "What is a chatbot designed to do?",
    xp: 1200,
    options: [
      { id: "a", text: "Repair computer hardware" },
      { id: "b", text: "Generate electricity" },
      { id: "c", text: "Communicate with users" },
      { id: "d", text: "Build physical robots" },
    ],
    correctAnswer: "c",
    hint: "It interacts with people through conversations.",
    explanation: "Chatbots are designed to interact with users through conversation.",
  },
  {
    id: "blaze-r1-q3",
    team: "blaze",
    round: 1,
    questionNumber: 3,
    type: "mcq",
    question: "Which is a common application of Computer Vision?",
    xp: 1400,
    options: [
      { id: "a", text: "Image Recognition" },
      { id: "b", text: "Water Purification" },
      { id: "c", text: "Battery Charging" },
      { id: "d", text: "Keyboard Manufacturing" },
    ],
    correctAnswer: "a",
    hint: "It involves interpreting visual information.",
    explanation: "Computer Vision helps machines understand images and videos.",
  },
];

/* --------------------------------------------------
   NOVA - ROUND 2
-------------------------------------------------- */

const novaRound2: QuantumQuestion[] = [
  {
    id: "nova-r2-q1",
    team: "nova",
    round: 2,
    questionNumber: 1,
    type: "mcq",
    question: "Which of these is a type of Machine Learning?",
    xp: 1500,
    options: [
      { id: "a", text: "Supervised Learning" },
      { id: "b", text: "Manual Typing" },
      { id: "c", text: "File Compression" },
      { id: "d", text: "Screen Recording" },
    ],
    correctAnswer: "a",
    hint: "The model learns using labeled examples.",
    explanation: "Supervised Learning trains models using labeled data.",
  },
  {
    id: "nova-r2-q2",
    team: "nova",
    round: 2,
    questionNumber: 2,
    type: "hidden",
    question: "Select the three technologies commonly associated with AI.",
    xp: 1800,
    selectionLimit: 3,
    tiles: [
      { id: "tile-1", text: "Machine Learning", isCorrect: true },
      { id: "tile-2", text: "Deep Learning", isCorrect: true },
      { id: "tile-3", text: "Natural Language Processing", isCorrect: true },
      { id: "tile-4", text: "Water Filtration", isCorrect: false },
      { id: "tile-5", text: "Mechanical Plumbing", isCorrect: false },
      { id: "tile-6", text: "Paper Printing", isCorrect: false },
    ],
    hint: "Choose technologies that help computers learn or understand information.",
    explanation: "Machine Learning, Deep Learning and NLP are AI-related technologies.",
  },
  {
    id: "nova-r2-q3",
    team: "nova",
    round: 2,
    questionNumber: 3,
    type: "drag-drop",
    question: "Arrange the steps of training an AI model in the correct order.",
    xp: 1600,
    steps: [
      { id: "train", text: "Train the Model" },
      { id: "test", text: "Test and Improve" },
      { id: "answer", text: "Give an Answer" },
      { id: "collect", text: "Collect Data" },
    ],
    correctOrder: ["collect", "train", "test", "answer"],
    hint: "The process begins by gathering training data.",
    explanation: "First collect data, train the model, test and improve it, then use it to produce an answer.",
  },
];

/* --------------------------------------------------
   BLAZE - ROUND 2
-------------------------------------------------- */

const blazeRound2: QuantumQuestion[] = [
  {
    id: "blaze-r2-q1",
    team: "blaze",
    round: 2,
    questionNumber: 1,
    type: "mcq",
    question: "What is the role of training data in Machine Learning?",
    xp: 1500,
    options: [
      { id: "a", text: "To decorate the interface" },
      { id: "b", text: "To help models learn patterns" },
      { id: "c", text: "To increase monitor brightness" },
      { id: "d", text: "To install computer hardware" },
    ],
    correctAnswer: "b",
    hint: "Models learn from examples.",
    explanation: "Training data provides examples that help models learn patterns.",
  },
  {
    id: "blaze-r2-q2",
    team: "blaze",
    round: 2,
    questionNumber: 2,
    type: "hidden",
    question: "Select the three real-world applications of AI.",
    xp: 1800,
    selectionLimit: 3,
    tiles: [
      { id: "tile-1", text: "Fraud Detection", isCorrect: true },
      { id: "tile-2", text: "Speech Recognition", isCorrect: true },
      { id: "tile-3", text: "Recommendation Systems", isCorrect: true },
      { id: "tile-4", text: "Manual Paper Folding", isCorrect: false },
      { id: "tile-5", text: "Traditional Hand Painting", isCorrect: false },
      { id: "tile-6", text: "Mechanical Door Hinges", isCorrect: false },
    ],
    hint: "Think about intelligent systems that identify patterns or make predictions.",
    explanation: "Fraud detection, speech recognition and recommendation systems commonly use AI.",
  },
  {
    id: "blaze-r2-q3",
    team: "blaze",
    round: 2,
    questionNumber: 3,
    type: "drag-drop",
    question: "Arrange the steps of an AI prediction workflow.",
    xp: 1600,
    steps: [
      { id: "predict", text: "Generate Prediction" },
      { id: "prepare", text: "Prepare Input Data" },
      { id: "evaluate", text: "Evaluate Result" },
      { id: "model", text: "Run the Trained Model" },
    ],
    correctOrder: ["prepare", "model", "predict", "evaluate"],
    hint: "Start by preparing the input data.",
    explanation: "Prepare data, run the model, generate a prediction and evaluate the result.",
  },
];

/* --------------------------------------------------
   COMPLETE QUESTION DATA
-------------------------------------------------- */

export const quantumChampsQuestions: QuantumQuestion[] = [
  ...novaRound1,
  ...blazeRound1,
  ...novaRound2,
  ...blazeRound2,
];

/* --------------------------------------------------
   HELPER FUNCTIONS
-------------------------------------------------- */

export function getQuestionsByTeam(
  team: Team,
  mode: GameMode = "full"
): QuantumQuestion[] {
  return quantumChampsQuestions.filter(
    (question) =>
      question.team === team &&
      (mode === "full" || question.round === 2)
  );
}

export function getQuestionsByRound(
  team: Team,
  round: 1 | 2
): QuantumQuestion[] {
  return quantumChampsQuestions.filter(
    (question) =>
      question.team === team &&
      question.round === round
  );
}

export function getQuestionByIndex(
  team: Team,
  index: number,
  mode: GameMode = "full"
): QuantumQuestion | null {
  const questions = getQuestionsByTeam(team, mode);

  return questions[index] ?? null;
}

export function getQuestionById(
  questionId: string
): QuantumQuestion | null {
  return (
    quantumChampsQuestions.find(
      (question) => question.id === questionId
    ) ?? null
  );
}

export function getQuestionCount(
  team: Team,
  mode: GameMode = "full"
): number {
  return getQuestionsByTeam(team, mode).length;
}

export function getQuestionRoute(
  question: QuantumQuestion
): string {
  const team = question.team;

  switch (question.type) {
    case "hidden":
      return `/quantum-champs-player/hidden-questions?team=${team}`;

    case "drag-drop":
      return `/quantum-champs-player/drag-drop-questions?team=${team}`;

    case "mcq":
    default:
      return `/quantum-champs-player/${team}-questions`;
  }
}

export function isCorrectAnswer(
  question: QuantumQuestion,
  answer: string | string[]
): boolean {
  if (question.type === "mcq") {
    return (
      typeof answer === "string" &&
      answer === question.correctAnswer
    );
  }

  if (question.type === "hidden") {
    if (!Array.isArray(answer)) return false;

    const correctIds = question.tiles
      .filter((tile) => tile.isCorrect)
      .map((tile) => tile.id);

    return (
      answer.length === question.selectionLimit &&
      new Set(answer).size === answer.length &&
      answer.every((id) => correctIds.includes(id)) &&
      correctIds.every((id) => answer.includes(id))
    );
  }

  if (question.type === "drag-drop") {
    if (!Array.isArray(answer)) return false;

    return (
      answer.length === question.correctOrder.length &&
      answer.every(
        (id, index) => id === question.correctOrder[index]
      )
    );
  }

  return false;
}
