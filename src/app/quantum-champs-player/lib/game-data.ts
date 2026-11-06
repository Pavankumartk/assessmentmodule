/** Quantum Champs — frontend-only dummy data and local game tracker.
 * All data is shared across tabs on the SAME browser origin only.
 * Replace storage functions with backend calls for genuine multi-device live play.
 */
export type TeamId = "nova" | "blaze";
export type GameMode = "full" | "quick";
export type Round = 1 | 2;
export type AnswerOption = { id: string; text: string };
export type GameQuestion = {
  id: string;
  team: TeamId;
  round: Round;
  number: number;
  question: string;
  options: AnswerOption[];
  correctOptionId: string;
  explanation: string;
  xp: number;
};
export type Participant = { id: string; name: string; team: TeamId; joinedAt: string };
export type TeamConfig = { id: TeamId; name: string; accessCode: string; maxParticipants: number };
export type RecordedAnswer = {
  questionId: string;
  team: TeamId;
  selectedOptionId: string;
  correct: boolean;
  earnedXp: number;
  answeredAt: string;
};
export type GameState = {
  id: string;
  mode: GameMode;
  status: "waiting" | "playing" | "finished";
  firstTeam: TeamId | null;
  currentTeam: TeamId | null;
  participants: Record<TeamId, Participant[]>;
  answers: RecordedAnswer[];
  scores: Record<TeamId, number>;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export const GAME_STORAGE_KEY = "qcDummyGameState";
export const TEAM_CONFIG: Record<TeamId, TeamConfig> = {
  nova: { id: "nova", name: "Team Nova", accessCode: "NOVA2026", maxParticipants: 5 },
  blaze: { id: "blaze", name: "Team Blaze", accessCode: "BLAZE2026", maxParticipants: 5 },
};
export const QUESTION_XP = [1000, 1500, 1500, 2000, 2500, 2500] as const;
export const MODE_CONFIG = {
  full: { name: "Full Game", rounds: [1, 2], questionsPerTeam: 6, totalQuestions: 12 },
  quick: { name: "Quick Game", rounds: [2], questionsPerTeam: 3, totalQuestions: 6 },
} as const;

function makeQuestion(
  team: TeamId,
  number: number,
  question: string,
  correct: string,
  wrong: [string, string, string],
  explanation: string,
): GameQuestion {
  return {
    id: `${team}-${number}`,
    team,
    round: number <= 3 ? 1 : 2,
    number,
    question,
    options: [
      { id: "a", text: correct },
      { id: "b", text: wrong[0] },
      { id: "c", text: wrong[1] },
      { id: "d", text: wrong[2] },
    ],
    correctOptionId: "a",
    explanation,
    xp: QUESTION_XP[number - 1],
  };
}

/** Twelve editable demo questions: six for each team. */
export const DUMMY_QUESTIONS: GameQuestion[] = [
  makeQuestion("nova", 1, "What is a neural network primarily inspired by?", "The human brain", ["Computer memory", "The internet", "Database architecture"], "Neural networks are inspired by networks of neurons in the brain."),
  makeQuestion("nova", 2, "What does AI stand for?", "Artificial Intelligence", ["Automated Internet", "Advanced Interface", "Artificial Integration"], "AI stands for Artificial Intelligence."),
  makeQuestion("nova", 3, "Which technique learns patterns from example data?", "Machine Learning", ["Manual Typing", "File Compression", "Screen Recording"], "Machine learning uses data to identify patterns and make predictions."),
  makeQuestion("nova", 4, "What is the main purpose of training an AI model?", "Learn patterns from data", ["Increase monitor brightness", "Replace computer storage", "Change file extensions"], "Training adjusts model parameters based on examples."),
  makeQuestion("nova", 5, "What is overfitting in machine learning?", "Learning training details too closely", ["Using too little memory", "Downloading a large file", "Reducing screen resolution"], "An overfit model performs well on training data but may generalize poorly."),
  makeQuestion("nova", 6, "Which metric is useful for measuring classification correctness?", "Accuracy", ["File size", "Screen width", "Download speed"], "Accuracy measures the proportion of correctly classified examples."),
  makeQuestion("blaze", 1, "Which is an AI technology?", "Machine Learning", ["Web Hosting", "Cloud Storage", "File Sharing"], "Machine Learning is a core AI technology that learns from data."),
  makeQuestion("blaze", 2, "Which field helps computers understand human language?", "Natural Language Processing", ["Disk Formatting", "Cable Routing", "Screen Calibration"], "NLP enables software to process and generate human language."),
  makeQuestion("blaze", 3, "What does computer vision analyze?", "Images and videos", ["Only battery levels", "Only keyboard layouts", "Only network cables"], "Computer vision extracts information from visual content."),
  makeQuestion("blaze", 4, "What is a training dataset?", "Examples used to teach a model", ["A computer wallpaper", "A list of passwords", "A browser theme"], "A training dataset provides examples from which a model learns."),
  makeQuestion("blaze", 5, "What is an AI model's inference step?", "Producing output from learned patterns", ["Deleting all input data", "Installing an operating system", "Charging a device"], "Inference is when a trained model processes new input to produce an output."),
  makeQuestion("blaze", 6, "Why is a separate test dataset important?", "To evaluate performance on unseen data", ["To increase font size", "To store device drivers", "To rename the model"], "A test dataset estimates how well a model generalizes to new examples."),
];

export function getQuestions(team: TeamId, mode: GameMode): GameQuestion[] {
  return DUMMY_QUESTIONS.filter(q => q.team === team && (mode === "full" || q.round === 2));
}

export function makeNewGame(mode: GameMode, id = `qc-${Date.now()}`): GameState {
  return {
    id,
    mode,
    status: "waiting",
    firstTeam: null,
    currentTeam: null,
    participants: { nova: [], blaze: [] },
    answers: [],
    scores: { nova: 0, blaze: 0 },
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  };
}

export function loadGame(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(GAME_STORAGE_KEY);
    return value ? (JSON.parse(value) as GameState) : null;
  } catch {
    return null;
  }
}

export function saveGame(game: GameState): GameState {
  if (typeof window !== "undefined") {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(game));
    window.dispatchEvent(new Event("qc-game-updated"));
  }
  return game;
}

/** Use at new lobby creation, not on every page load or turn change. */
export function createGame(mode: GameMode): GameState {
  return saveGame(makeNewGame(mode));
}

export function joinTeam(game: GameState, name: string, accessCode: string): GameState {
  if (game.status !== "waiting") throw new Error("This game is no longer accepting players.");
  const team = (Object.keys(TEAM_CONFIG) as TeamId[]).find(
    id => TEAM_CONFIG[id].accessCode === accessCode.trim().toUpperCase(),
  );
  if (!team) throw new Error("Invalid team access code.");
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Enter the participant name.");
  if (game.participants[team].length >= TEAM_CONFIG[team].maxParticipants) {
    throw new Error(`${TEAM_CONFIG[team].name} is full (5/5).`);
  }
  if (game.participants[team].some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
    throw new Error("This participant name is already registered on the team.");
  }
  const participant: Participant = {
    id: `${team}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: cleanName,
    team,
    joinedAt: new Date().toISOString(),
  };
  return saveGame({
    ...game,
    firstTeam: game.firstTeam ?? team,
    participants: { ...game.participants, [team]: [...game.participants[team], participant] },
  });
}

export function isLobbyFull(game: GameState): boolean {
  return (Object.keys(TEAM_CONFIG) as TeamId[]).every(
    team => game.participants[team].length === TEAM_CONFIG[team].maxParticipants,
  );
}

export function startGame(game: GameState): GameState {
  if (game.status !== "waiting") throw new Error("The game has already started.");
  if (!isLobbyFull(game)) throw new Error("Wait until all 5 Nova and all 5 Blaze participants have joined.");
  if (!game.firstTeam) throw new Error("No first team is registered.");
  return saveGame({ ...game, status: "playing", currentTeam: game.firstTeam, startedAt: new Date().toISOString() });
}

export function getNextQuestion(game: GameState, team: TeamId): GameQuestion | null {
  const answeredIds = new Set(game.answers.map(a => a.questionId));
  return getQuestions(team, game.mode).find(q => !answeredIds.has(q.id)) ?? null;
}

export function recordAnswer(game: GameState, team: TeamId, questionId: string, selectedOptionId: string): GameState {
  if (game.status !== "playing") throw new Error("The game is not in progress.");
  if (game.currentTeam !== team) throw new Error("It is not this team's turn.");
  const nextQuestion = getNextQuestion(game, team);
  if (!nextQuestion || nextQuestion.id !== questionId) throw new Error("This is not the team's current question.");
  if (!nextQuestion.options.some(o => o.id === selectedOptionId)) throw new Error("Invalid answer option.");
  const correct = selectedOptionId === nextQuestion.correctOptionId;
  const earnedXp = correct ? nextQuestion.xp : 0;
  const answers = [...game.answers, {
    questionId, team, selectedOptionId, correct, earnedXp, answeredAt: new Date().toISOString(),
  }];
  const scores = { ...game.scores, [team]: game.scores[team] + earnedXp };
  const allAnswered = answers.length === MODE_CONFIG[game.mode].totalQuestions;
  return saveGame({
    ...game,
    answers,
    scores,
    currentTeam: allAnswered ? null : team === "nova" ? "blaze" : "nova",
    status: allAnswered ? "finished" : "playing",
    finishedAt: allAnswered ? new Date().toISOString() : null,
  });
}

export function getWinner(game: GameState): TeamId | "tie" | null {
  if (game.status !== "finished") return null;
  if (game.scores.nova === game.scores.blaze) return "tie";
  return game.scores.nova > game.scores.blaze ? "nova" : "blaze";
}

export function getGameSummary(game: GameState) {
  const total = MODE_CONFIG[game.mode].questionsPerTeam;
  return {
    mode: game.mode,
    status: game.status,
    teams: (Object.keys(TEAM_CONFIG) as TeamId[]).map(team => ({
      team,
      members: game.participants[team].length,
      maxMembers: TEAM_CONFIG[team].maxParticipants,
      answered: game.answers.filter(a => a.team === team).length,
      totalQuestions: total,
      xp: game.scores[team],
    })),
    winner: getWinner(game),
  };
}
