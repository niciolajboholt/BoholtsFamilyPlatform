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
  events: { title: string; start: string }[];
  openTasks: string[];
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

function formatWeeklySummaryPrompt(input: WeeklySummaryInput): string {
  const lines: string[] = [];

  lines.push("Kommende kalenderaftaler denne uge:");
  if (input.events.length > 0) {
    for (const event of input.events) {
      lines.push(`- ${event.start}: ${event.title}`);
    }
  } else {
    lines.push("(ingen)");
  }

  lines.push("", "Åbne opgaver denne uge:");
  if (input.openTasks.length > 0) {
    for (const task of input.openTasks) {
      lines.push(`- ${task}`);
    }
  } else {
    lines.push("(ingen)");
  }

  lines.push("", "Varer på indkøbslisten:");
  if (input.shoppingItems.length > 0) {
    for (const item of input.shoppingItems) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("(ingen)");
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
    `kalenderaftaler, åbne opgaver og indkøbsliste. Skriv 2-4 korte sætninger i en varm, ` +
    `hverdagsagtig tone — ingen overskrifter, ingen punktopstilling, ingen indledende "Her er". ` +
    `Nævn kun det, der reelt er givet, opfind intet.`;

  const content = await runChatCompletion(env, systemPrompt, formatWeeklySummaryPrompt(input));

  return content?.trim() || null;
}
