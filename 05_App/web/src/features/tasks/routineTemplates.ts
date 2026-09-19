// Sprint 54 (Fase 4 af 51_Barnets_Hjemmecentral_Plan.md): faste
// rutineskabeloner ét niveau over den generiske rutine-editor
// (RoutineCreateDialog i pages/TasksPage.tsx). En skabelon udfylder blot
// navn, ugedage og opgaver i den EKSISTERENDE editor — nøjagtig samme
// mekanisme som AI-forslaget allerede bruger (onSuggest) — i stedet for en
// ny opret-vej eller egen datamodel.

import type { TaskIconKey } from "./taskIcons";

export interface RoutineTemplateItem {
  name: string;
  icon: TaskIconKey;
  timeOfDay?: string | null;
}

export interface RoutineTemplate {
  key: string;
  label: string;
  routineName: string;
  // Et fornuftigt udgangspunkt, ikke bindende — brugeren kan justere
  // ugedagene i editoren bagefter, ligesom resten af skabelonens felter.
  defaultWeekdays: number[];
  items: RoutineTemplateItem[];
}

const weekdays = [1, 2, 3, 4, 5];
const everyDay = [1, 2, 3, 4, 5, 6, 7];

export const routineTemplates: RoutineTemplate[] = [
  {
    key: "morgenrutine",
    label: "Morgenrutine",
    routineName: "Morgenrutine",
    defaultWeekdays: weekdays,
    items: [
      { name: "Stå op", icon: "morgen" },
      { name: "Børst tænder", icon: "hygiejne" },
      { name: "Tag tøj på", icon: "morgen" },
      { name: "Spis morgenmad", icon: "mad" },
    ],
  },
  {
    key: "skoletaske",
    label: "Skoletaske",
    routineName: "Pak skoletasken",
    defaultWeekdays: weekdays,
    items: [
      { name: "Madpakke", icon: "mad" },
      { name: "Bøger og lektier", icon: "skole" },
      { name: "Idrætstøj (hvis idræt i dag)", icon: "motion" },
      { name: "Underskrevne sedler", icon: "skole" },
    ],
  },
  {
    key: "tandborstning",
    label: "Tandbørstning",
    routineName: "Tandbørstning",
    defaultWeekdays: everyDay,
    items: [
      { name: "Børst tænder, morgen", icon: "hygiejne", timeOfDay: "07:30" },
      { name: "Børst tænder, aften", icon: "hygiejne", timeOfDay: "19:30" },
    ],
  },
  {
    key: "sengetid",
    label: "Sengetid",
    routineName: "Sengetid",
    defaultWeekdays: everyDay,
    items: [
      { name: "Tag pyjamas på", icon: "aften" },
      { name: "Børst tænder", icon: "hygiejne" },
      { name: "Læg tøj klar til i morgen", icon: "aften" },
      { name: "Sluk lys", icon: "aften" },
    ],
  },
];
