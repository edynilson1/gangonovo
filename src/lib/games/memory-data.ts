export type MemoryCategory = {
  id: string;
  label: string;
  emoji: string;
  items: string[];
};

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  {
    id: "frutas",
    label: "Frutas",
    emoji: "🍓",
    items: ["🍎", "🍌", "🍇", "🍓", "🍍", "🥝", "🍉", "🍒", "🥑", "🍑"],
  },
  {
    id: "animais",
    label: "Animais",
    emoji: "🦁",
    items: ["🦁", "🐯", "🐘", "🦊", "🐼", "🐨", "🦄", "🐙", "🦉", "🐢"],
  },
  {
    id: "espaco",
    label: "Espaço",
    emoji: "🚀",
    items: ["🚀", "🛰️", "🪐", "🌙", "⭐", "☄️", "🔭", "👽", "🌍", "🌞"],
  },
  {
    id: "desporto",
    label: "Desporto",
    emoji: "⚽",
    items: ["⚽", "🏀", "🏈", "🎾", "🏓", "🥊", "🏊", "🚴", "🏹", "⛳"],
  },
];

export const MEMORY_DIFFICULTIES = [
  { id: "facil", label: "Fácil", pairs: 6 },
  { id: "medio", label: "Médio", pairs: 8 },
  { id: "dificil", label: "Difícil", pairs: 10 },
] as const;

export type MemoryCard = { key: string; value: string; matched: boolean };

export function buildMemoryDeck(categoryId: string, pairs: number): MemoryCard[] {
  const category = MEMORY_CATEGORIES.find((c) => c.id === categoryId) ?? MEMORY_CATEGORIES[0]!;
  const chosen = [...category.items].sort(() => Math.random() - 0.5).slice(0, pairs);
  const deck = chosen.flatMap((value, index) => [
    { key: `${index}-a`, value, matched: false },
    { key: `${index}-b`, value, matched: false },
  ]);
  return deck.sort(() => Math.random() - 0.5);
}
