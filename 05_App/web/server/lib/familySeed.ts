// Generiske standardmedlemmer for en helt ny familie — samme navne/farver
// som klientens hidtidige lokale seed (calendarOwners.ts, ADR-015), nu bare
// skrevet direkte til D1 i stedet for localStorage. "family" er
// pseudo-medlemmet der repræsenterer hele familien som helhed.
export interface FamilyMemberSeed {
  id: string;
  name: string;
  color: string;
  relation: string | null;
}

export const familyMemberSeeds: FamilyMemberSeed[] = [
  { id: "far", name: "Far", color: "#2E7D32", relation: "Far" },
  { id: "mor", name: "Mor", color: "#C06C84", relation: "Mor" },
  { id: "barn-1", name: "Barn 1", color: "#D99832", relation: "Barn" },
  { id: "barn-2", name: "Barn 2", color: "#4D7EA8", relation: "Barn" },
  { id: "family", name: "Familien", color: "#6D597A", relation: null },
];

const inviteCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // uden 0/O/1/I

export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = "";

  for (const byte of bytes) {
    code += inviteCodeAlphabet[byte % inviteCodeAlphabet.length];
  }

  return code;
}

// Sprint 26: familiens delelink-token. I modsætning til invitationskoden
// (som et menneske taster ind, derfor kort og fra et læsevenligt alfabet)
// bliver dette kopieret/delt direkte som en URL — langt nok (32 bytes) til
// at være praktisk ugætteligt.
export function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
