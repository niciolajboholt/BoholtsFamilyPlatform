// Krypterer Googles refresh-token, før den gemmes i D1 — D1 har ingen
// indbygget kolonne-kryptering, så det gøres her med AES-GCM og en nøgle fra
// en Worker-secret (wrangler secret put GOOGLE_TOKEN_ENCRYPTION_KEY), aldrig
// i klartekst i databasen.

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function importEncryptionKey(base64Key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(base64Key),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

const ivLengthBytes = 12;

// Output: base64(iv) + "." + base64(ciphertext) — begge dele er nødvendige
// for at kunne dekryptere igen, IV må aldrig genbruges mellem kald.
export async function encryptRefreshToken(
  plaintext: string,
  base64Key: string,
): Promise<string> {
  const key = await importEncryptionKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(ivLengthBytes));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptRefreshToken(
  encrypted: string,
  base64Key: string,
): Promise<string> {
  const [ivPart, ciphertextPart] = encrypted.split(".");

  if (!ivPart || !ciphertextPart) {
    throw new Error("Ugyldigt krypteret refresh-token-format.");
  }

  const key = await importEncryptionKey(base64Key);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivPart) },
    key,
    base64ToBytes(ciphertextPart),
  );

  return new TextDecoder().decode(plaintext);
}
