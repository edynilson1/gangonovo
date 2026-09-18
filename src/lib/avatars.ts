const SEEDS = [
  "arena",
  "nova",
  "pixel",
  "turbo",
  "sonic",
  "laser",
  "orbit",
  "vortex",
  "quartz",
  "zenit",
  "cobra",
  "lumen",
];

export const AVATAR_PRESETS = SEEDS.map(
  (seed) => `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}&radius=50`,
);

export function avatarFor(seed: string): string {
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}&radius=50`;
}
