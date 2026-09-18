# CLAUDE.md

Denne fil indlæses automatisk af Claude Code ved sessionsstart. Den
duplikerer ikke projektets fulde dokumentation — den er en kort,
sikkerhedskritisk indgang, der peger videre til den fulde AI Knowledge Base.

## Læs dette først

- [`01_Project_Documentation/AI_Knowledge_Base/11_AI_Onboarding_Guide.md`](01_Project_Documentation/AI_Knowledge_Base/11_AI_Onboarding_Guide.md) —
  obligatorisk indgang for enhver ny session; henviser videre til resten af
  Knowledge Base.
- [`01_Project_Documentation/AI_Knowledge_Base/06_Claude_Playbook.md`](01_Project_Documentation/AI_Knowledge_Base/06_Claude_Playbook.md) —
  den fulde arbejdsgang og mandat.

## De regler der ikke må glemmes

- **Commit/push/merge**: Kun efter Nicolaj har testet den konkrete ændring
  og givet eksplicit godkendelse. Det er ikke en stående tilladelse til
  fremtidige ændringer.
- **`main` og `develop` er beskyttede branches** (PR + grøn CI påkrævet).
  Alt arbejde leveres via branch + pull request — aldrig et direkte push til
  en af de to.
- **D1-migrationer**: `.github/workflows/ci.yml`s `deploy-beta`- og
  `deploy-production`-jobs kører i dag `wrangler d1 migrations apply`
  automatisk ved push til hhv. `develop`/`main`, og verificerer bagefter
  `/api/health`s `migrations.ok`. Dette er *ikke* det, README og
  `09_Lessons_Learned.md` beskriver (de forudsætter manuel kørsel via
  D1-konsollen) — en reel dokumentation-vs-kode-uoverensstemmelse, som bør
  afklares med Nicolaj snarere end antages løst. Uanset hvilken proces der
  gælder: en migrations "kørt"-status skal altid bekræftes direkte (health
  check eller `sqlite_master`-forespørgsel), aldrig blot antages.
- **Dokumentation kan halte bagefter koden.** Uoverensstemmelser (som ovenfor)
  flages til Nicolaj — de rettes eller antages ikke stiltiende.
- **Risikable/uigenkaldelige handlinger** (force-push, sletning af branches,
  ændring af delt infrastruktur) kræver altid eksplicit forhåndsgodkendelse.

## Arbejdsmappe og kommandoer

Al app-kode ligger under `05_App/web`. Kvalitetskommandoerne matcher
`.github/workflows/ci.yml` 1:1:

```bash
cd 05_App/web
npm run lint
npm run build              # tsc -b && vite build
npm run worker:types:check
npm test                   # Vitest
npm run test:e2e           # Playwright (kræver chromium)
```

## Teknologistak (kort)

Cloudflare Workers (Hono) + D1 (SQLite) på serveren, React 19 + TypeScript +
Vite + Material UI på klienten. Node `24.15.0`. Se
[`01_Project_Documentation/AI_Knowledge_Base/08_Development_Standards.md`](01_Project_Documentation/AI_Knowledge_Base/08_Development_Standards.md)
for den fulde standard.
