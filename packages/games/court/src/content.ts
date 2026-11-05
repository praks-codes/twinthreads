// Ready-made text, and the backup lines used whenever the AI fails or is too slow.

export type Crowd = "calm" | "gasp" | "boo" | "aww" | "laugh";
export type Mood =
  | "neutral"
  | "happy"
  | "laugh"
  | "cry"
  | "annoyed"
  | "nervous"
  | "smug"
  | "love";
export type JudgeMood = "tired" | "stern" | "pleased" | "shocked";
export type JudgeId = "tired" | "dramatic" | "romantic";

export const CROWDS: readonly Crowd[] = ["calm", "gasp", "boo", "aww", "laugh"];
export const MOODS: readonly Mood[] = [
  "neutral",
  "happy",
  "laugh",
  "cry",
  "annoyed",
  "nervous",
  "smug",
  "love",
];
export const JUDGE_MOODS: readonly JudgeMood[] = [
  "tired",
  "stern",
  "pleased",
  "shocked",
];

export const JUDGES: Record<
  JudgeId,
  { name: string; tagline: string; mood: JudgeMood; persona: string }
> = {
  tired: {
    name: "Burned-out",
    tagline: "I've seen 4,000 of these.",
    mood: "tired",
    persona:
      "very tired and calm. You have seen too many of these cases and you want a nap, but you are sweet about it",
  },
  dramatic: {
    name: "Dramatic",
    tagline: "Every crumb is a tragedy.",
    mood: "stern",
    persona:
      "very dramatic. You act like every tiny thing is the biggest news ever, with big feelings but simple words",
  },
  romantic: {
    name: "Hopeless romantic",
    tagline: "Rules for love, every time.",
    mood: "pleased",
    persona:
      "a big softie who loves love. You think everything they do is cute, even their fights",
  },
};

export const READY_ACCUSATIONS: readonly string[] = [
  "Left one sip of milk in the carton and put it back.",
  "Said five more minutes and was gone for forty.",
  'Says "fine" when it is very much not fine.',
  "Steals the duvet, then claims to be cold.",
  "Watched the next episode without me.",
  "Asks what's for dinner, then rejects every answer.",
];

export const FILL_IN_ACCUSATIONS: readonly [string, string, string][] = [
  ["You always", "when I", "."],
  ["You swore you'd never", "but then you", "."],
  ["Every time I", "you just", "."],
];

export const EXAMPLE_DEFENSES: readonly string[] = [
  "I have no memory of this.",
  "You do it too.",
  "I did it for us.",
  "That was a different person. Who looks like me.",
];

export const OBJECTION_GROUNDS: readonly string[] = [
  "Irrelevant",
  "Pure lies",
  "Hearsay",
  "Too dramatic",
];

export const EMOTES: readonly string[] = ["😭", "😂", "😤", "😍", "🙄", "😇"];

export const MOOD_EMOJI: Record<Mood, string> = {
  neutral: "",
  happy: "😊",
  laugh: "😂",
  cry: "😭",
  annoyed: "😤",
  nervous: "😬",
  smug: "😏",
  love: "😍",
};

export const FALLBACK = {
  hearing: [
    "OK. I heard you both.",
    "Hmm. You both have a point. Sort of.",
    "I need a snack before I think about this.",
  ],
  crossQuestions: [
    "So how do you explain that?",
    "Can you say that again, slowly?",
    "Who told you that was OK?",
  ],
  crossReact: ["Is that your answer? OK.", "Huh. That almost makes sense."],
  reply: ["OK. I heard that.", "Hmm. Go on.", "That is a good one. I think."],
  lawyer: [
    { style: "Sincere", text: "I'm sorry. Can I make it up to you?" },
    { style: "Unhinged", text: "I was sleepwalking. It was not me." },
    { style: "Blame the pet", text: "It was the dog. We don't have a dog." },
  ],
  sustained: "Good point. I agree.",
  overruled: "Nice try, but no.",
  punishments: [
    "Make the next three cups of tea.",
    "Say the other one was right. Out loud. Twice.",
    "Let your partner pick the TV show tonight.",
  ],
  guiltyLines: ["Yes, you did it. It was small, but you did it."],
  innocentLines: ["You did nothing wrong. This time."],
  headlines: ["Case Closed At Home", "Couple Survives Big Trial"],
  dismissed:
    "This sounds like a real talk, not a game. Case closed, with love.",
} as const;
