# Boholts Familieapp – web

Den aktive klient til Boholts Family Platform. Appen er bygget med React,
TypeScript, Vite og Material UI og er optimeret til mobil brug.

## Kom i gang

Brug Node.js `24.15.0` eller nyere i Node 24-serien.

```bash
npm ci
npm run dev
```

Vite viser derefter den lokale adresse i terminalen.

## Kommandoer

```bash
npm run dev      # lokal udviklingsserver
npm run lint     # ESLint
npm run build    # TypeScript-kontrol og produktionsbuild
npm test         # Vitest
npm run preview  # lokal visning af produktionsbuild
```

## Google Calendar-konfiguration

Google-login og -kalenderadgang er server-side (authorization-code+PKCE via
`server/routes/auth.ts`/`server/lib/googleOAuth.ts`), ikke en klient-`VITE_*`-
opsætning — der findes ikke længere nogen `.env.local`-variabel for Google.
`GOOGLE_CLIENT_ID` er en almindelig `vars`-værdi i `wrangler.jsonc`;
`GOOGLE_CLIENT_SECRET` er en Cloudflare Secrets Store-binding. Se
`src/features/calendar/providers/google/README.md` for den fulde
OAuth-arkitektur, scope-liste og opsætningsvejledning.

## Centrale kodeområder

- `src/pages` – appens sider.
- `src/features/calendar` – modeller, hooks, providers, services og UI.
- `src/features/calendar/providers/google` – Google Calendar-adapteren.
- `src/features/calendar/preferences` – lokale brugerindstillinger.
- `src/test` – fælles testopsætning.

## Kendte afgrænsninger

- PWA-afhængigheden er installeret, men offline-cache og installérbarhed er ikke
  færdigkonfigureret.
- Lokale data er fortsat browser- og enhedsafhængige.
- Gentagne aftaler er ikke færdigimplementeret.
- Google-sessionen bruger ikke backend eller refresh-token.
