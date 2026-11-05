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
      "exhausted and deadpan. You have judged thousands of these and want a nap",
  },
  dramatic: {
    name: "Dramatic",
    tagline: "Every crumb is a tragedy.",
    mood: "stern",
    persona:
      "wildly theatrical. Every tiny offence is a tragedy of historic proportions",
  },
  romantic: {
    name: "Hopeless romantic",
    tagline: "Rules for love, every time.",
    mood: "pleased",
    persona:
      "a hopeless romantic. You swoon at everything and find even fights adorable",
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

export const WITNESSES: readonly {
  name: string;
  color: string;
  note: string;
  persona: string;
  says: string;
  line: string;
  delta: number;
  crowd: Crowd;
}[] = [
  {
    name: "Gummy Greg",
    color: "#8FD9FF",
    note: "Reliable. Saw everything, probably.",
    persona: "a reliable, dramatic gummy bear who supports whoever called him",
    says: "I saw it all. It looked terrible.",
    line: "Compelling, for a bear.",
    delta: 7,
    crowd: "gasp",
  },
  {
    name: "Mrs Sour",
    color: "#B9F2C8",
    note: "A risk. She adores everyone but you.",
    persona: "a sour gummy who betrays whoever called her to the stand",
    says: "Honestly? The other one is lovely. Always has been.",
    line: "Your own witness betrayed you.",
    delta: -5,
    crowd: "aww",
  },
  {
    name: "Fizz",
    color: "#FFB070",
    note: "Unpredictable. Possibly asleep.",
    persona: "a confused gummy who was asleep and mostly asks about snacks",
    says: "I was asleep. Is there a buffet?",
    line: "Remove this bear from my court.",
    delta: 0,
    crowd: "boo",
  },
];

export const BRIBES: readonly {
  name: string;
  note: string;
  says: string;
  line: string;
  delta: number;
  crowd: Crowd;
}[] = [
  {
    name: "A warm cookie",
    note: "Tasteful. Might work.",
    says: "I offer the Court this cookie.",
    line: "Accepted. This never happened.",
    delta: 6,
    crowd: "aww",
  },
  {
    name: "A love note",
    note: "Sweet, but the judge has read thousands.",
    says: "Dear Judge, you seem nice.",
    line: "The Court is slightly touched.",
    delta: 3,
    crowd: "aww",
  },
  {
    name: "A bag of cash",
    note: "Bold. Probably contempt of court.",
    says: "Just between us, Your Honor...",
    line: "Contempt of court! Shame!",
    delta: -8,
    crowd: "boo",
  },
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
    "Both sides heard. Sadly.",
    "The Court has heard worse. Not often.",
    "Noted. With deep concern.",
  ],
  evidence: "The worst drawing I have ever seen. Admitted.",
  crossQuestions: [
    "How exactly do you explain yourself?",
    "Would you say that again, slowly, under oath?",
    "And who, precisely, told you that was acceptable?",
  ],
  crossReact: [
    "That is your answer? Noted, with sorrow.",
    "Annoyingly, that nearly made sense.",
  ],
  lawyer: [
    { style: "Sincere", text: "I'm sorry. I'd do anything to fix this." },
    { style: "Unhinged", text: "I was following orders from the fridge." },
    { style: "Blame the pet", text: "Blame the dog. We don't own a dog." },
  ],
  sustained: "A real argument. The Court is stunned. Sustained.",
  overruled: "That was barely a sentence. Overruled.",
  punishments: [
    "Make the next three cups of tea and look sorry.",
    "Admit the other was right. Out loud. Twice.",
    "Give up control of the TV remote for one whole evening.",
  ],
  guiltyLines: ["The evidence is overwhelming. And petty."],
  innocentLines: ["The Court finds nothing here but drama."],
  headlines: ["Household Justice Served", "Local Couple Shaken By Trial"],
  dismissed:
    "This sounds like a real conversation, not a court case. Court dismissed, with love.",
} as const;
