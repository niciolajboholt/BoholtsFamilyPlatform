-- Sprint 48: Microsoft-login på lige vilkår med Google — se
-- 48_Sprint48_Login_Microsoft_Apple_Kalenderforbindelser_Plan.md.
--
-- BEMÆRK bevidst valg: users.google_sub forbliver NOT NULL. SQLite/D1 kan
-- ikke ændre en NOT NULL-begrænsning uden at genskabe hele tabellen
-- (DROP+CREATE+RENAME), og "users" er usædvanligt centralt refereret —
-- omkring 15 andre tabeller (sessions, google_connections, families,
-- family_memberships, tasks, m.fl.) har en FK til users(id). D1 håndhæver
-- fremmednøgler og kører hver migrationsfil i én implicit transaktion,
-- hvilket gør både "PRAGMA foreign_keys=OFF" og "PRAGMA defer_foreign_keys"
-- virkningsløse for netop denne slags genopbygning (bekræftet både ved
-- lokal afprøvning og i Cloudflares egne GitHub-issues, fx
-- cloudflare/workers-sdk#5438) — en reel genopbygning ville kræve at
-- kopiere alle ~15 relaterede tabellers data ud, genskabe "users", og
-- indsætte dem igen, hvilket er uforholdsmæssigt risikabelt for denne
-- opgave.
--
-- I stedet får en Microsoft-only bruger en deterministisk, garanteret
-- unik "ms:"-præfikset placeholder-værdi i google_sub (kan aldrig kollidere
-- med en ægte Google-sub, som altid er et rent numerisk tal) — se
-- auth.ts's /microsoft/callback. Kun de to login-ruter i auth.ts
-- læser/skriver google_sub direkte; ingen andre steder i koden fortolker
-- feltet som "har forbundet Google" (det gør i stedet den separate
-- google_connections-tabel), så dette er trygt.
ALTER TABLE users ADD COLUMN microsoft_sub TEXT;

CREATE UNIQUE INDEX idx_users_microsoft_sub ON users(microsoft_sub);
