export interface Quote {
  text: string;
  author: string;
}

/**
 * Hand-picked grit for the DSA grind. The dashboard shows one per day
 * (deterministic by date) and lets you shuffle for more.
 */
export const MOTIVATIONAL_QUOTES: Quote[] = [
  {
    text: "The only way to learn a new programming language is by writing programs in it.",
    author: "Dennis Ritchie",
  },
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    text: "Don't watch the clock; do what it does. Keep going.",
    author: "Sam Levenson",
  },
  {
    text: "The expert in anything was once a beginner.",
    author: "Helen Hayes",
  },
  {
    text: "You don't have to be great to start, but you have to start to be great.",
    author: "Zig Ziglar",
  },
  {
    text: "Discipline is choosing between what you want now and what you want most.",
    author: "Abraham Lincoln",
  },
  {
    text: "Talk is cheap. Show me the code.",
    author: "Linus Torvalds",
  },
  {
    text: "Every master was once a disaster.",
    author: "T. Harv Eker",
  },
  {
    text: "The pain of discipline is far lighter than the pain of regret.",
    author: "Sarah Bombell",
  },
  {
    text: "One problem a day keeps the imposter syndrome away.",
    author: "Anonymous",
  },
  {
    text: "There are no shortcuts to any place worth going.",
    author: "Beverly Sills",
  },
  {
    text: "First, solve the problem. Then, write the code.",
    author: "John Johnson",
  },
  {
    text: "If you're going through hell, keep going.",
    author: "Winston Churchill",
  },
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
  },
  {
    text: "Hard things are worth doing — that's exactly why they're hard.",
    author: "Anonymous",
  },
  {
    text: "It's not that I'm so smart, it's just that I stay with problems longer.",
    author: "Albert Einstein",
  },
  {
    text: "The difference between ordinary and extraordinary is that little extra.",
    author: "Jimmy Johnson",
  },
  {
    text: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier",
  },
  {
    text: "Simplicity is the soul of efficiency.",
    author: "Austin Freeman",
  },
  {
    text: "Fall seven times, stand up eight.",
    author: "Japanese proverb",
  },
  {
    text: "Your most unhappy customers are your greatest source of learning.",
    author: "Bill Gates",
  },
  {
    text: "The grind isn't glamorous, but the results are.",
    author: "Anonymous",
  },
  {
    text: "Someday is not a day of the week.",
    author: "Janet Dailey",
  },
  {
    text: "A year from now you may wish you had started today.",
    author: "Karen Lamb",
  },
  {
    text: "You miss 100% of the problems you don't attempt.",
    author: "Wayne Gretzky (probably)",
  },
  {
    text: "Brilliant things happen in calm minds. Be calm. Keep going.",
    author: "Anonymous",
  },
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic quote index for a date key — a fresh pick each day. */
export function dailyQuoteIndex(dateKey: string): number {
  return hashCode(dateKey) % MOTIVATIONAL_QUOTES.length;
}

/** A random quote index different from `current` (null for a fresh pick). */
export function randomQuoteIndex(current: number | null): number {
  if (MOTIVATIONAL_QUOTES.length <= 1) return 0;
  let next = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  while (next === current) {
    next = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  }
  return next;
}
