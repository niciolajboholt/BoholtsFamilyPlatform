# 13 — Release- og sikkerhedsgrundlag

> Status: Aktiv · Version 2.2 · Opdateret 2026-08-27

## Arkitektur og data

Appen er en React/TypeScript-PWA serveret af en Cloudflare Worker (Hono).
Fælles data ligger i D1; enhedspræferencer og en begrænset kalendercache kan
ligge i browseren. Google-login er server-ejet med PKCE, HttpOnly-session og
krypteret refresh-token. Outlook bruger MSAL på klienten.

Hemmeligheder ligger i Cloudflare Secrets Store og bindes i `wrangler.jsonc`.
Ikke-hemmelige værdier som OAuth client-id og VAPID public key må ligge i
konfigurationen. `.env*` og `.dev.vars*` er ignoreret af Git.

## Release-checkliste

Før merge eller deploy:

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. `npm test`
5. `npm run test:e2e`
6. `wrangler deploy --dry-run --env beta`
7. Gennemgå diff og dependency-advarsler for secrets og risikable ændringer.
8. Kør nye D1-migrationer på beta og kontrollér `/api/health`.
9. Smoke-test login, kalender, opgaver, indkøb, indstillinger og delelink på beta.
10. Merge først derefter til `main`; kør migrationer i produktion før kode, der
    kræver de nye kolonner/tabeller, bliver taget i brug.

GitHub Actions kører lint, build, Vitest og Playwright på pull requests og
pushes til `develop`/`main`, og deployer selv beta (kvalitetssikret
`wrangler deploy`-trin med migration og live health-verifikation) ved push
til `develop`. Cloudflares egen native Git-integration ("Workers Builds") er
stadig konfigureret på samme repo og forsøger at deploye ved hvert push, men
fejler konsekvent og skal slås fra i Cloudflare-dashboardet — indtil da er
den kun støj (to røde checks pr. push) og ikke den reelle deploy-vej. Se
Fase 7 i `30_Stabilization_Execution_Plan.md`.

`main` og `develop` er beskyttede branches: PR med grøn `Lint, build and
test`-check er påkrævet, ingen direkte push er muligt (sat op 2026-08-27).

## Sikkerhedskontroller

- CSP, `X-Content-Type-Options`, `Referrer-Policy` og `frame-ancestors 'none'`.
- `Cache-Control: no-store` på auth- og API-svar.
- Rate limits på invitationer, AI, push og offentlige delelinks.
- Rolle-/medlemskabstjek på familieendpoints.
- Krypterede Google refresh-tokens og Secure/HttpOnly/SameSite-sessioncookies.
- Offentlige kalenderlinks viser som standard kun titel og tidspunkt;
  beskrivelse/lokation kræver aktivt tilvalg og linket kan tilbagekaldes.
- Aftaler markeret private (Google `visibility`/Outlook `sensitivity`, eller
  markeret "Privat" i opret/redigér-dialogen) redigeres server-side til
  "Optaget" i familievisning, delelinks, push og AI-ugeresumé — kun det
  familiemedlem, kalenderen tilhører, ser de fulde detaljer.
- AI-ugeresumé kan fravælges for hele familien; fravalget filtreres før data
  indsamles.
- Strukturerede Worker-logs og Cloudflare versionsmetadata i `/api/health`.

## Backup, retention og offline

D1 er den autoritative kilde til familie, opgaver og indkøbslister. Eksporten i
Indstillinger dækker lokale browserdata; den er ikke en komplet D1-backup.
Google/Outlook ejer kalenderaftalerne. App-skallen og tidligere hentede assets
kan åbnes offline, men servermutationer køes ikke endnu; UI'en siger derfor
tydeligt, når ændringer kræver forbindelse.

Udløbne sessioner og gamle rate-limit-poster ryddes af cron. En fuld slette-/
retentionprocedure for en hel konto/familie bør dokumenteres før offentlig
lancering.

## Rollback og migrationer

Kode rulles tilbage med en ny Git-revert og Cloudflare-deploy; undgå at omskrive
fælles branchhistorik. D1-migrationer er fremadrettede og skal designes
additivt. `CF_VERSION_METADATA` på health-endpointet identificerer den aktive
deploy.

### D1 backup/restore-runbook (Time Travel)

D1 har ingen manuel "tag en backup"-handling — Cloudflare gemmer i stedet
løbende et point-in-time-restore-vindue på **30 dage** for hver database
("Time Travel"), uden ekstra opsætning. Det er den reelle backup-mekanisme;
"Eksporter data" i Indstillinger dækker kun browserdata og er ikke en
D1-backup (se ovenfor).

**1. Find et gendannelsespunkt (ikke-destruktivt, sikkert at køre når som helst):**

```sh
npx wrangler d1 time-travel info DB --env beta --json
```

Dette kører allerede automatisk som "Record D1 restore point" i
`deploy-beta`-jobbet i `.github/workflows/ci.yml`, **før** hver
migrationskørsel — så der altid findes et logget bookmark fra lige før
seneste deploy i GitHub Actions-loggen. `--timestamp=<Unix eller RFC3339>`
kan bruges til at slå et bookmark op for et bestemt tidspunkt op til 30 dage
tilbage, hvis man ikke har den automatisk loggede værdi ved hånden.

**2. Gendan til det punkt (destruktivt — se advarsel nedenfor):**

```sh
npx wrangler d1 time-travel restore DB --env beta --bookmark=<bookmark>
# eller, uden et gemt bookmark:
npx wrangler d1 time-travel restore DB --env beta --timestamp=<Unix eller RFC3339>
```

`DB` er bindingnavnet fra `wrangler.jsonc`, ikke databasens visningsnavn —
samme konvention som de øvrige `wrangler d1`-kommandoer i
`deploy-beta`-jobbet.

**Advarsler, før kommandoen køres:**

- Gendannelsen overskriver databasens NUVÆRENDE indhold med tilstanden fra
  gendannelsespunktet — enhver skrivning efter det tidspunkt (nye
  familiemedlemmer, aftaler, opgaver, indkøb) går tabt for den database, det
  køres mod. Der er ingen "fortryd" ud over at gendanne til et endnu senere
  bookmark, hvis et sådant findes.
- Kør aldrig denne kommando mod produktionsdatabasen (`--env` udeladt/uden
  `beta`) uden at have talt med Nicolaj først — det er præcis den slags
  hård-at-fortryde, delt-system-handling, som kræver eksplicit accept, jf.
  denne sessions arbejdsregel.
- Efter en gendannelse: kør `npx wrangler d1 migrations apply DB --env <miljø>
  --remote` for at sikre at migrationsregistret stemmer overens med skemaet,
  og verificér `/api/health` bagefter.

**Status:** Selve mekanismen (bookmark-optagelse) er allerede i produktion via
CI, og er dokumenteret her med korrekt kommandosyntaks (verificeret mod den
installerede `wrangler`-CLI's egen `--help`, ikke kun hukommelse). En reel
gendannelsesøvelse — at faktisk køre `restore` og bekræfte resultatet — er
bevidst **ikke** udført af denne agent, da det er en skarp, produktions-lignende
handling på en database, appen deler med rigtige brugere. Den bør planlægges
som en bevidst øvelse (fx mod en kortvarigt oprettet test-D1-database, eller
et aftalt tidsvindue på beta) næste gang Nicolaj har tid, ikke udføres
autonomt.

## Eksterne releasekrav

Google OAuth consent screen skal have verificeret branding, autoriserede
domæner samt offentlige links til privatlivspolitik og vilkår. Repositoryet
leverer siderne `/privacy` og `/terms`; selve Google-verifikationen kræver
projektejers adgang til Google Cloud Console.

## Relaterede filer

- `05_App/web/wrangler.jsonc`
- `05_App/web/server/worker-configuration.d.ts`
- `05_App/web/server/migrations/`
- `.github/workflows/ci.yml`
- `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`
