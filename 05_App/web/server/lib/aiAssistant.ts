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
// medlemsfelt i skemaet — se shopping_list_items). Holdt som streng-nøgle,
// ikke `undefined`, så den kan stå i Map'en og samtidig altid ende sidst
// (se `order`-opbygningen nedenfor).
const FAELLES_GROUP = "Fælles (ingen bestemt person)";

function formatWeeklySummaryPrompt(input: WeeklySummaryInput): string {
  const groupedLines = new Map<string, string[]>();
  const orderedNames: string[] = [];

  function addLine(memberName: string | undefined, line: string): void {
    const key = memberName ?? FAELLES_GROUP;
    if (!groupedLines.has(key)) {
      groupedLines.set(key, []);
      if (key !== FAELLES_GROUP) {
        orderedNames.push(key);
      }
    }
    groupedLines.get(key)!.push(line);
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

  const lines: string[] = ["Ugens aftaler, opgaver og indkøb, grupperet pr. person (i denne rækkefølge):"];

  if (orderedNames.length === 0 && !groupedLines.has(FAELLES_GROUP)) {
    lines.push("(ingen)");
    return lines.join("\n");
  }

  for (const name of orderedNames) {
    lines.push(`${name}:`, ...groupedLines.get(name)!);
  }
  if (groupedLines.has(FAELLES_GROUP)) {
    lines.push(`${FAELLES_GROUP}:`, ...groupedLines.get(FAELLES_GROUP)!);
  }

  return lines.join("\n");
}

// I modsætning til rutine-/ingrediensforslagene ovenfor beder denne funktion
// bevidst IKKE om JSON — et ugeresumé er ren læsetekst til familien, ikke
// data der skal parses ind i konkrete felter (Sprint 28, beslutning 3).
export async function generateWeeklySummary(
  env: Env,
  input: WeeklySummaryInput,
): Promise<string | null> {
  const systemPrompt =
    `Du skriver et kort, venligt ugeresumé på dansk til en familie, ud fra deres kommende ` +
    `kalenderaftaler og opgaver, der herunder er grupperet pr. familiemedlem, samt en fælles ` +
    `indkøbsliste. Skriv resuméet som ÉN kort sætning (højst to) PR. NAVNGIVET PERSON, hver på ` +
    `sin egen linje — brug et almindeligt linjeskift mellem hver person, i nøjagtig den ` +
    `rækkefølge, personerne er listet nedenfor. Start hver linje med personens navn efterfulgt af ` +
    `kolon, fx "Nicolaj: ...". Spring en person helt over, hvis vedkommende slet ikke er nævnt ` +
    `nedenfor. Er der noget under "${FAELLES_GROUP}", så afslut med præcis én linje, der starter ` +
    `med "Fælles: ", om det (inkl. indkøb, hvis der er noget) — ellers udelad linjen helt. ` +
    `Ingen overskrifter og ingen punktopstillingstegn ("-" eller "•") i selve svaret — kun ` +
    `almindelige sætninger på hver sin linje, i et naturligt, varmt hverdagssprog, som når man ` +
    `kort fortæller familien, hvad ugen byder på. Ingen indledende "Her er" eller "Denne uge ` +
    `byder på". ` +
    `Aftalerne/opgaverne under hver person står allerede i den rigtige rækkefølge med ugedag (og ` +
    `evt. klokkeslæt) angivet præcist — nævn dem i samme rækkefølge, og brug UDELUKKENDE de ` +
    `ugedage/tidspunkter, der er givet. Regn, gæt eller antag aldrig selv en dato eller et ` +
    `klokkeslæt. Nævn kun det, der reelt er givet: opfind aldrig en kategori, et sted, en ` +
    `anledning eller et ord som "stævne"/"begivenhed", der ikke selv står i aftalens eller ` +
    `opgavens egen titel.`;

  const content = await runChatCompletion(env, systemPrompt, formatWeeklySummaryPrompt(input));

  return content?.trim() || null;
}
