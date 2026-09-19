// Sprint 53: PIN-kode-hashing til børneadgang — se migration 0032 og
// childSession.ts. En 4-cifret PIN har kun 10.000 kombinationer, så selv
// PBKDF2 med mange iterationer beskytter ikke reelt mod en offline
// brute-force af en lækket database — den egentlige beskyttelse er det
// ugættelige child_access_token (kun relevant EFTER man allerede har det)
// og den strenge rate-begrænsning på selve verificerings-ruten
// (routes/childAccess.ts). PBKDF2 bruges alligevel som et billigt ekstra
// lag, ikke som den primære forsvarslinje.

const pbkdf2Iterations = 100_000;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

async function derivePinHash(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: pbkdf2Iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );

  return new Uint8Array(bits);
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// Gemmes som "<salt-hex>:<hash-hex>" i family_members.pin_hash.
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePinHash(pin, salt);
  return `${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(":");

  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = fromHex(saltHex);
  const expected = fromHex(hashHex);
  const actual = await derivePinHash(pin, salt);

  if (actual.length !== expected.length) {
    return false;
  }

  // Konstant-tid sammenligning — undgår at svartiden lækker, hvor mange
  // indledende bytes der matchede.
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual[i] ^ expected[i];
  }

  return diff === 0;
}
