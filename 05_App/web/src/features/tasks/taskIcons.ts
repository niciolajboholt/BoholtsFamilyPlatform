// Klient-spejl af server/lib/taskIcons.ts's faste ikonsæt (Sprint 23) —
// nøglerne skal holdes i sync med serveren, da de gemmes som rå strenge i
// D1. Selve MUI-ikon-komponenterne findes kun her, ikke server-side.

import {
  CleanHandsOutlined,
  CleaningServicesOutlined,
  FitnessCenterOutlined,
  MenuBookOutlined,
  NightsStayOutlined,
  PetsOutlined,
  RestaurantOutlined,
  SchoolOutlined,
  SportsEsportsOutlined,
  WbSunnyOutlined,
} from "@mui/icons-material";

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

export type TaskIconKey = (typeof taskIcons)[number];

export const taskIconLabels: Record<TaskIconKey, string> = {
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

export const taskIconComponents = {
  morgen: WbSunnyOutlined,
  mad: RestaurantOutlined,
  skole: SchoolOutlined,
  hygiejne: CleanHandsOutlined,
  motion: FitnessCenterOutlined,
  laesning: MenuBookOutlined,
  husholdning: CleaningServicesOutlined,
  kaeledyr: PetsOutlined,
  fritid: SportsEsportsOutlined,
  aften: NightsStayOutlined,
} satisfies Record<TaskIconKey, typeof WbSunnyOutlined>;

export function isTaskIconKey(value: string): value is TaskIconKey {
  return (taskIcons as readonly string[]).includes(value);
}
