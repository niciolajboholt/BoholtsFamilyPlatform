// Sprint 30 (tilføjelse): sender en mail til appens ejer, hver gang der
// kommer ny feedback — så den ikke kun ligger i indbakken under
// Indstillinger, som ejeren selv skal huske at tjekke. Cloudflare Workers
// kan ikke sende vilkårlig udgående mail uden en ekstern tjeneste, derfor
// Resend (https://resend.com) via deres HTTP API. Afsenderadressen
// "onboarding@resend.dev" kræver ingen domæneverificering, men kan (indtil
// et rigtigt domæne er verificeret hos Resend) kun sende til den e-mail,
// Resend-kontoen selv er oprettet med.

import type { Env } from "../env";

interface FeedbackNotificationInput {
  category: string;
  message: string;
  page: string | null;
  senderName: string;
  senderEmail: string;
}

const categoryLabels: Record<string, string> = {
  idea: "Idé",
  bug: "Fejl",
  other: "Andet",
};

export async function sendFeedbackNotificationEmail(
  env: Env,
  entry: FeedbackNotificationInput,
): Promise<void> {
  const apiKey = await env.RESEND_API_KEY.get();

  // Ikke sat endnu (fx lokal udvikling, eller før secret'en er oprettet i
  // Cloudflares Secrets Store) — mailen er en bonus-notifikation, ikke
  // feedbackens primære lagring, så den springes bare over.
  if (!apiKey) {
    return;
  }

  const categoryLabel = categoryLabels[entry.category] ?? entry.category;

  const bodyLines = [
    `${entry.senderName} (${entry.senderEmail}) sendte feedback:`,
    "",
    entry.message,
  ];

  if (entry.page) {
    bodyLines.push("", `Side: ${entry.page}`);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Boholts Familieapp <onboarding@resend.dev>",
      to: env.ADMIN_EMAIL,
      reply_to: entry.senderEmail,
      subject: `Ny feedback (${categoryLabel}) fra ${entry.senderName}`,
      text: bodyLines.join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend svarede ${response.status}: ${await response.text()}`,
    );
  }
}
