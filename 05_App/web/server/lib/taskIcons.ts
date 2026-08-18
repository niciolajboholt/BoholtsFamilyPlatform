// Sprint 23: fast ikonsæt for opgaver/rutiner, samme filosofi som
// shoppingCategories.ts's kategorisæt — ikke brugerdefinerbart, for at
// holde UI'et roligt og konsistent (Tiimo-inspireret). Nøglerne er stabile
// identifikatorer gemt i D1; selve ikon-tegningen sker klient-side.

export const taskIcons = [
  "morgen",
  "mad",
  "skole",
  "hygiejne",
  "motion",
  "laesning",
  "husholdning",
  "kaeledyr",
  "fritid",
  "aften",
] as const;

export type TaskIcon = (typeof taskIcons)[number];

export function isTaskIcon(value: string): value is TaskIcon {
  return (taskIcons as readonly string[]).includes(value);
}

export const taskIconLabels: Record<TaskIcon, string> = {
  morgen: "Morgen",
  mad: "Mad",
  skole: "Skole/lektier",
  hygiejne: "Hygiejne",
  motion: "Motion",
  laesning: "Læsning",
  husholdning: "Husholdning",
  kaeledyr: "Kæledyr",
  fritid: "Fritid",
  aften: "Aften/sengetid",
};
