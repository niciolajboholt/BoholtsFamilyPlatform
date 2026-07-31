# Boholts Family Platform

Boholts Family Platform er en Apple-first familieplatform, som samler familiens
aftaler og kalenderkilder i én mobilvenlig webapp.

## Aktuel status

- React-webappen udvikles på `develop`.
- Sprint 0–16 er gennemført, inklusive gentagne aftaler (recurrence) og valg
  af hvilke Google-kalendere der skal medtages ved forbindelse.
- Google Calendar kan læses og skrives via en brugerautoriseret session.
- Stabiliseringsmilepælen fra den eksterne audit (2026-07-29) er gennemført
  (15 af 17 fund løst eller udført); se
  [10_Future_Roadmap.md](01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md)
  for status på de enkelte fund (F-01 til F-17).

Se [AI Knowledge Base](01_Project_Documentation/AI_Knowledge_Base/00_README.md)
for projektets historik, arkitektur og beslutninger.

## Teknologi

- React 19 og TypeScript
- Vite
- Material UI
- Vitest
- Google Calendar API
- PWA: manifest og service worker er konfigureret (`vite-plugin-pwa`); Google
  Calendar-kald og OAuth caches aldrig, se ADR-013.

Platformskiftet fra SwiftUI til React/PWA er dokumenteret i ADR-010 i
[arkitekturbeslutningerne](01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md).

## Lokal udvikling

Forudsætning: Node.js `24.15.0` eller nyere i Node 24-serien.

```bash
cd 05_App/web
npm ci
npm run dev
```

Kvalitetskontrol:

```bash
npm run lint
npm run build
npm test
```

GitHub Actions kører de samme kontroller ved pull requests og pushes til
`develop` og `main`.

## Google Calendar

Kopiér `05_App/web/.env.example` til `05_App/web/.env.local`, og udfyld en
Google OAuth Web Client ID:

```dotenv
VITE_GOOGLE_CALENDAR_ENABLED=true
VITE_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

Hemmeligheder og tokens må ikke committes. OAuth-tokenet opbevares kun i
browserhukommelsen; appen har endnu ingen backend eller refresh-token.

## Deployment

Appen deployes til [Cloudflare Pages](https://pages.cloudflare.com/), forbundet
direkte til dette GitHub-repo med automatisk deploy ved push til `main`. Se
ADR-013 for begrundelsen (skalerbarhed på gratis-planen, ingen begrænsning mod
kommerciel brug, og en naturlig vej til en fremtidig backend via Cloudflare
Workers/D1, hvis det bliver relevant).

Build-indstillinger i Cloudflare Pages' dashboard:

- **Rodmappe**: `05_App/web`
- **Build-kommando**: `npm run build`
- **Output-mappe**: `dist`
- **Miljøvariabler**: `VITE_GOOGLE_CALENDAR_ENABLED`, `VITE_GOOGLE_CLIENT_ID`
  (samme værdier som i `.env.local`, sættes i dashboardet — committes aldrig)

Efter første deploy skal production-URL'en (`https://<projekt>.pages.dev`)
tilføjes som "Authorized JavaScript origin" på Google OAuth-klienten i Google
Cloud Console, ellers fejler Google-login på den deployede adresse.

## Repository-strategi

- `develop` er integrationsbranch for valideret udvikling.
- `main` er releasebranch og repositoryets default branch.
- Ændringer leveres via branches og pull requests.

Dokumentationen vedligeholdes som Markdown i repositoryet.
