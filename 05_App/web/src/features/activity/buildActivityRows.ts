// Sprint 33 ("Siden sidst du var her"): oversætter den rå aktivitets-DTO
// fra serveren til en flad, PRIORITERET rækkefølge af visningsrækker —
// ændringer der kræver et blik (flyttet/aflyst aftale) først, rent nyt
// bagefter. Delt af både dialogen med de vigtigste (som viser toppen af
// listen) og "Vis alt"-dialogen (som grupperer den fulde liste pr. ikon).

import type { ActiveActivitySummary } from "../family/familyApi";

export type ActivityRowIcon = "calendar" | "check" | "cart" | "family";

export interface ActivityRow {
  id: string;
  attention: boolean;
  icon: ActivityRowIcon;
  title: string;
  detail?: string;
}

function formatShortWeekdayTime(iso: string): string {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat("da-DK", { weekday: "short" })
    .format(date)
    .replace(/\.$/, "");
  const time = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${weekday} ${time}`;
}

function formatWeekdayLong(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", { weekday: "long" }).format(new Date(iso));
}

export function buildActivityRows(summary: ActiveActivitySummary): ActivityRow[] {
  const rows: ActivityRow[] = [];

  for (const event of summary.calendar.moved) {
    rows.push({
      id: `moved-${event.title}-${event.newStart ?? ""}`,
      attention: true,
      icon: "calendar",
      title: `${event.title} er flyttet`,
      detail:
        event.oldStart && event.newStart
          ? `${formatShortWeekdayTime(event.oldStart)} → ${formatShortWeekdayTime(event.newStart)}`
          : undefined,
    });
  }

  for (const event of summary.calendar.cancelled) {
    rows.push({
      id: `cancelled-${event.title}-${event.oldStart ?? ""}`,
      attention: true,
      icon: "calendar",
      title: `${event.title} er aflyst`,
      detail: event.oldStart ? formatShortWeekdayTime(event.oldStart) : undefined,
    });
  }

  if (summary.calendar.created.length > 0) {
    const [next] = summary.calendar.created;
    const count = summary.calendar.created.length;

    rows.push({
      id: "calendar-created",
      attention: false,
      icon: "calendar",
      title: `${count} ${count === 1 ? "ny aftale" : "nye aftaler"} i kalenderen`,
      detail: next?.start ? `Næste: ${next.title}, ${formatWeekdayLong(next.start)}` : undefined,
    });
  }

  if (summary.tasksCompletedCount > 0 || summary.tasksCreatedCount > 0) {
    const parts: string[] = [];

    if (summary.tasksCompletedCount > 0) {
      parts.push(
        `${summary.tasksCompletedCount} ${summary.tasksCompletedCount === 1 ? "opgave" : "opgaver"} fuldført`,
      );
    }

    if (summary.tasksCreatedCount > 0) {
      parts.push(
        `${summary.tasksCreatedCount} ${summary.tasksCreatedCount === 1 ? "ny opgave" : "nye opgaver"} oprettet`,
      );
    }

    rows.push({ id: "tasks", attention: false, icon: "check", title: parts.join(", ") });
  }

  if (summary.shoppingAddedCount > 0 || summary.shoppingCheckedCount > 0) {
    const parts: string[] = [];

    if (summary.shoppingAddedCount > 0) {
      parts.push(`${summary.shoppingAddedCount} ${summary.shoppingAddedCount === 1 ? "vare" : "varer"} tilføjet`);
    }

    if (summary.shoppingCheckedCount > 0) {
      parts.push(`${summary.shoppingCheckedCount} streget af`);
    }

    rows.push({ id: "shopping", attention: false, icon: "cart", title: parts.join(", ") });
  }

  if (summary.newFamilyMembers.length > 0) {
    const names = summary.newFamilyMembers.map((member) => member.name);

    rows.push({
      id: "family",
      attention: false,
      icon: "family",
      title:
        names.length === 1
          ? `${names[0]} er tilføjet som familiemedlem`
          : `${names.join(", ")} er tilføjet som familiemedlemmer`,
    });
  }

  return rows;
}
