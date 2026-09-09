// Sprint 40: et fast, ukonfigurerbart "7 dage før"-tjek af familiemedlemmers
// fødselsdage, kaldt fra index.ts's scheduled()-handler ved det EKSISTERENDE
// daglige cron-tick ("0 4 * * *") — ingen ny cron-trigger, samme begrundelse
// som event-/opgave-påmindelserne på 5-minutters-tick'et (kontoens loft på 5
// cron-triggers, se ADR-018).
//
// Ingen idempotens-kolonne nødvendig: daysUntilNextBirthday() regner altid
// mod NÆSTE forekomst, så betingelsen "=== 7" kun er sand på ÉN bestemt dag
// om året pr. medlem — i modsætning til tidsbaserede opgave-/aftale-
// påmindelser (event_reminders/reminded_at), som kan ramme det samme
// tidspunkt flere gange, hvis cronen af en eller anden grund kører mere end
// forventet samme dag.

import type { Env } from "../env";
import { daysUntilNextBirthday } from "./birthday";
import { sendPushNotificationToFamily } from "./pushNotifications";
import { logError } from "./structuredLog";

const reminderOffsetDays = 7;

interface FamilyMemberWithBirthdayRow {
  id: string;
  familyId: string;
  name: string;
  birthday: string;
  linkedUserId: string | null;
}

export async function sendDueBirthdayReminders(env: Env, now: Date = new Date()): Promise<void> {
  const { results: members } = await env.DB.prepare(
    `SELECT id, family_id AS familyId, name, birthday, linked_user_id AS linkedUserId
     FROM family_members
     WHERE birthday IS NOT NULL`,
  ).all<FamilyMemberWithBirthdayRow>();

  for (const member of members) {
    if (daysUntilNextBirthday(member.birthday, now) !== reminderOffsetDays) {
      continue;
    }

    // Udelader fødselaren selv, hvis vedkommende har en koblet konto —
    // samme "skjul for personen selv"-princip som gaveplanerne (ADR-020).
    // En tom streng matcher aldrig et rigtigt bruger-id (se
    // taskReminders.ts's tilsvarende mønster), så INGEN udelades, når
    // medlemmet ikke har nogen konto at udelade.
    await sendPushNotificationToFamily(env, member.familyId, member.linkedUserId ?? "", {
      title: "Fødselsdag om en uge",
      body: `${member.name} har fødselsdag om en uge.`,
      url: "/settings",
    }).catch((error: unknown) => {
      logError("Kunne ikke sende fødselsdagspåmindelse", error, { memberId: member.id });
    });
  }
}
