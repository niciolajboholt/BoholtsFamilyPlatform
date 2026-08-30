// Sprint 23: AI-modul via Cloudflare Workers AI — genererer forslag
// (rutine ud fra en sætning, ingredienser ud fra en ret), aldrig noget der
// gemmes automatisk (se 23_Sprint23_Opgaver_Plan.md, beslutning 4). En let,
// gratis-tilgængelig model, ikke en af de store betalingskrævende — data
// forlader ikke Cloudflares infrastruktur.

import type { Env } from "../env";
import { logError } from "./structuredLog";
import { isTaskIcon, taskIcons } from "./taskIcons";

const model = "@cf/zai-org/glm-4.7-flash";

export interface RoutineDraftItem {
  name: string;
  icon: string;
  timeOfDay: string | null;
}

export interface RoutineDraft {
  name: string;
  items: RoutineDraftItem[];
}

export interface IngredientDraftItem {
  name: string;
}

export interface WeeklySummaryInput {
  events: { title: string; start: string; allDay: boolean; memberName?: string }[];
  openTasks: { name: string; memberName?: string }[];
  shoppingItems: string[];
}

async function runChatCompletion(
  env: Env,
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  try {
    const response = await env.AI.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    return response.choices?.[0]?.message?.content ?? null;
  } catch (error: unknown) {
    logError("Workers AI-kald fejlede", error);
    return null;
  }
}

// Modellen bliver bedt om at svare med ren JSON, men kan ikke stoles på til
// altid at gøre det (forklarende sætninger, ```json-kodeblokke) — udtrækker
// den første {...}-blok i stedet for at kræve, at hele svaret er gyldig JSON.
function extractJsonObject(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function generateRoutineDraft(
  env: Env,
  description: string,
): Promise<RoutineDraft | null> {
  const systemPrompt =
    `Du hjælper med at lave en dagsrutine for en dansk familie ud fra en kort beskrivelse. ` +
    `Svar UDELUKKENDE med et JSON-objekt i formen ` +
    `{"name": string, "items": [{"name": string, "icon": string, "timeOfDay": string eller null}]}. ` +
    `"icon" skal være ét af: ${taskIcons.join(", ")}. "timeOfDay" er formatet "TT:MM", eller null hvis intet tidspunkt er oplagt. ` +
    `Svar udelukkende med JSON, ingen forklarende tekst.`;

  const content = await runChatCompletion(env, systemPrompt, description);

  if (!content) {
    return null;
  }

  const parsed = extractJsonObject(content);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidate = parsed as { name?: unknown; items?: unknown };

  if (typeof candidate.name !== "string" || !candidate.name.trim() || !Array.isArray(candidate.items)) {
    return null;
  }

  const items: RoutineDraftItem[] = [];

  for (const rawItem of candidate.items) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as { name?: unknown; icon?: unknown; timeOfDay?: unknown };

    if (typeof item.name !== "string" || !item.name.trim()) {
      continue;
    }

    items.push({
      name: item.name.trim(),
      icon: typeof item.icon === "string" && isTaskIcon(item.icon) ? item.icon : "fritid",
      timeOfDay:
        typeof item.timeOfDay === "string" && /^\d{2}:\d{2}$/.test(item.timeOfDay)
          ? item.timeOfDay
          : null,
    });
  }

  if (items.length === 0) {
    return null;
  }

  return { name: candidate.name.trim(), items };
}

export async function generateIngredientsDraft(
  env: Env,
  dish: string,
): Promise<IngredientDraftItem[] | null> {
  const systemPrompt =
    `Du foreslår typiske ingredienser til en dansk husholdnings indkøbsliste ud fra navnet på en ret. ` +
    `Svar UDELUKKENDE med et JSON-objekt i formen {"items": [{"name": string}]}, med almindelige, ` +
    `enkeltstående varenavne (fx "hakket oksekød", ikke "500g hakket oksekød"). Maks. 12 varer. ` +
    `Svar udelukkende med JSON, ingen forklarende tekst.`;

  const content = await runChatCompletion(env, systemPrompt, dish);

  if (!content) {
    return null;
  }

  const parsed = extractJsonObject(content);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidate = parsed as { items?: unknown };

  if (!Array.isArray(candidate.items)) {
    return null;
  }

  const items: IngredientDraftItem[] = [];

  for (const rawItem of candidate.items) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as { name?: unknown };

    if (typeof item.name === "string" && item.name.trim()) {
      items.push({ name: item.name.trim() });
    }
  }

  return items.length > 0 ? items : null;
}

// Formaterer ugedag (og, hvis relevant, klokkeslæt) på dansk her i koden —
// deterministisk og altid korrekt — i stedet for at give modellen en rå
// ISO 8601 UTC-streng og forvente, at den selv regner tidszone og ugedag
// ud. En lille, hurtig model (se model-konstanten øverst) er upålidelig til
// den slags datoregning, hvilket var en væsentlig kilde til forvirrede,
// usammenhængende resuméer (forkert ugedagsrækkefølge, opfundne detaljer).
function formatEventLine(event: WeeklySummaryInput["events"][number]): string {
  const date = new Date(event.start);
  const weekday = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    timeZone: "Europe/Copenhagen",
  }).format(date);
  const who = event.memberName ? ` (${event.memberName})` : "";

  if (event.allDay) {
    return `- ${weekday}: ${event.title}${who}`;
  }

  const time = new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen",
  }).format(date);

  return `- ${weekday} kl. ${time}: ${event.title}${who}`;
}

// "Fælles" samler alt uden en navngiven ejer: familie-brede aftaler/opgaver
// (intet family_members-id) og hele indkøbslisten (som slet ikke har et
// medlemsfelt i skemaet — se shopping_list_items).
const FAELLES_GROUP = "Fælles";

interface GroupedWeeklySummaryInput {
  // Navngivne personer, i den rækkefølge de først optræder — den rækkefølge
  // det endelige resumé også skal vises i.
  orderedNames: string[];
  linesByGroup: Map<string, string[]>;
}

function groupWeeklySummaryInput(input: WeeklySummaryInput): GroupedWeeklySummaryInput {
  const linesByGroup = new Map<string, string[]>();
  const orderedNames: string[] = [];

  function addLine(memberName: string | undefined, line: string): void {
    const key = memberName ?? FAELLES_GROUP;
    if (!linesByGroup.has(key)) {
      linesByGroup.set(key, []);
      if (key !== FAELLES_GROUP) {
        orderedNames.push(key);
      }
    }
    linesByGroup.get(key)!.push(line);
  }

  for (const event of input.events) {
    addLine(event.memberName, formatEventLine(event));
  }
  for (const task of input.openTasks) {
    addLine(task.memberName, `- Opgave: ${task.name}`);
  }
  for (const item of input.shoppingItems) {
    addLine(undefined, `- Indkøb: ${item}`);
  }

  return { orderedNames, linesByGroup };
}

function formatWeeklySummaryPrompt(grouped: GroupedWeeklySummaryInput): string {
  const { orderedNames, linesByGroup } = grouped;
  const lines: string[] = ["Ugens aftaler, opgaver og indkøb, grupperet pr. person (i denne rækkefølge):"];

  if (orderedNames.length === 0 && !linesByGroup.has(FAELLES_GROUP)) {
    lines.push("(ingen)");
    return lines.join("\n");
  }

  for (const name of orderedNames) {
    lines.push(`${name}:`, ...linesByGroup.get(name)!);
  }
  if (linesByGroup.has(FAELLES_GROUP)) {
    lines.push(`${FAELLES_GROUP}:`, ...linesByGroup.get(FAELLES_GROUP)!);
  }

  return lines.join("\n");
}

export interface WeeklySummarySection {
  name: string;
  text: string;
}

function parseWeeklySummarySectionsJson(content: string): { name: string; text: string }[] | null {
  const parsed = extractJsonObject(content);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidate = parsed as { sections?: unknown };

  if (!Array.isArray(candidate.sections)) {
    return null;
  }

  const sections: { name: string; text: string }[] = [];

  for (const raw of candidate.sections) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const section = raw as { name?: unknown; text?: unknown };

    if (typeof section.name === "string" && section.name.trim() && typeof section.text === "string" && section.text.trim()) {
      sections.push({ name: section.name.trim(), text: section.text.trim() });
    }
  }

  return sections.length > 0 ? sections : null;
}

// Slår modellens egne (navn, tekst)-par sammen med den kendte, korrekte
// rækkefølge/liste af personer — i stedet for blot at stole på JSON-
// arrayets egen rækkefølge og de navne, modellen selv har skrevet. Den
// lille model har vist sig upålidelig nok til begge dele (se Fase-
// stabiliseringsplanens "Ugens resumé"-afsnit): den kan finde på en ekstra,
// uventet gruppe (fx "Familien" ved siden af "Fælles") eller returnere
// sektionerne i en anden rækkefølge, end de blev givet i. Et navn, der ikke
// matcher en kendt person eller selve "Fælles"-nøglen, lægges derfor ind i
// den fælles tekst i stedet for at blive vist som en overraskende, ekstra
// overskrift.
function reconcileWeeklySummarySections(
  rawSections: { name: string; text: string }[],
  grouped: GroupedWeeklySummaryInput,
): WeeklySummarySection[] {
  const textsByName = new Map<string, string[]>();
  const faellesTexts: string[] = [];

  for (const section of rawSections) {
    const matchedName = grouped.orderedNames.find(
      (name) => name.toLowerCase() === section.name.toLowerCase(),
    );

    if (matchedName) {
      const texts = textsByName.get(matchedName) ?? [];
      texts.push(section.text);
      textsByName.set(matchedName, texts);
    } else {
      faellesTexts.push(section.text);
    }
  }

  const result: WeeklySummarySection[] = [];

  for (const name of grouped.orderedNames) {
    const texts = textsByName.get(name);
    if (texts && texts.length > 0) {
      result.push({ name, text: texts.join(" ") });
    }
  }

  if (faellesTexts.length > 0) {
    result.push({ name: FAELLES_GROUP, text: faellesTexts.join(" ") });
  }

  return result;
}

export async function generateWeeklySummary(
  env: Env,
  input: WeeklySummaryInput,
): Promise<WeeklySummarySection[] | null> {
  const grouped = groupWeeklySummaryInput(input);

  const systemPrompt =
    `Du skriver et kort ugeresumé på dansk til en familie, ud fra deres kommende kalenderaftaler ` +
    `og opgaver, der herunder er grupperet pr. familiemedlem, samt en fælles indkøbsliste. ` +
    `Svar UDELUKKENDE med et JSON-objekt i formen {"sections": [{"name": string, "text": string}]}. ` +
    `Opret præcis én sektion pr. gruppe, der rent faktisk er nævnt nedenfor — spring en gruppe ` +
    `helt over, hvis den slet ikke er nævnt. "name" skal være PRÆCIS det navn, gruppen har ` +
    `nedenfor (fx "Nicolaj" eller "${FAELLES_GROUP}") — opfind aldrig et andet navn eller en ` +
    `anden gruppe. "text" er én kort sætning (højst to) i et naturligt, varmt hverdagssprog om ` +
    `det, personen/gruppen skal — uden at gentage navnet i selve teksten (det vises i forvejen ` +
    `sammen med sektionen). ` +
    `Aftalerne/opgaverne under hver gruppe står allerede i den rigtige rækkefølge med ugedag (og ` +
    `evt. klokkeslæt) angivet præcist — nævn dem i samme rækkefølge i teksten, og brug ` +
    `UDELUKKENDE de ugedage/tidspunkter, der er givet. Regn, gæt eller antag aldrig selv en dato ` +
    `eller et klokkeslæt. Nævn kun det, der reelt er givet: opfind aldrig en kategori, et sted, ` +
    `en anledning eller et ord som "stævne"/"begivenhed", der ikke selv står i aftalens eller ` +
    `opgavens egen titel. Svar udelukkende med JSON, ingen forklarende tekst.`;

  const content = await runChatCompletion(env, systemPrompt, formatWeeklySummaryPrompt(grouped));

  if (!content) {
    return null;
  }

  const rawSections = parseWeeklySummarySectionsJson(content);

  if (!rawSections) {
    return null;
  }

  const sections = reconcileWeeklySummarySections(rawSections, grouped);

  return sections.length > 0 ? sections : null;
}
