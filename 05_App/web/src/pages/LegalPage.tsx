import type { ReactNode } from "react";

import { ArrowBackRounded } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

interface LegalPageProps {
  kind: "privacy" | "terms";
}

const updatedAt = "26. august 2026";

export default function LegalPage({ kind }: LegalPageProps) {
  const isPrivacy = kind === "privacy";

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", px: 2, py: { xs: 3, sm: 6 } }}>
      <Button component={RouterLink} to="/" startIcon={<ArrowBackRounded />} sx={{ mb: 2 }}>
        Tilbage til appen
      </Button>

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {isPrivacy ? "Privatlivspolitik" : "Vilkår for brug"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Senest opdateret {updatedAt}
          </Typography>

          {isPrivacy ? <PrivacyContent /> : <TermsContent />}
        </CardContent>
      </Card>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>{title}</Typography>
      <Box sx={{ color: "text.secondary" }}>{children}</Box>
    </Box>
  );
}

function PrivacyContent() {
  return (
    <>
      <Section title="Hvilke data appen bruger">
        Appen gemmer din Google-profil, familiemedlemskab, opgaver, indkøbslister,
        kalenderkoblinger, notifikationsabonnementer og de indstillinger, der er
        nødvendige for at levere funktionerne.
      </Section>
      <Section title="Data fra din Google-konto">
        <Typography color="text.secondary" component="span" sx={{ display: "block", mb: 1.5 }}>
          Når du logger ind med Google, beder appen om følgende adgang:
        </Typography>
        <Box component="ul" sx={{ color: "text.secondary", m: 0, pl: 3 }}>
          <Box component="li">
            <strong>Din grundlæggende profil</strong> (navn, e-mailadresse,
            profilbillede) — bruges til at oprette og genkende din konto i
            appen.
          </Box>
          <Box component="li">
            <strong>Læse- og skriveadgang til din Google Kalender</strong>{" "}
            (<code>calendar.events</code>) — bruges til at vise dine Google-
            aftaler i familiens fælles kalendervisning, og til at
            oprette/redigere/slette aftaler, når du bruger appens
            kalenderfunktioner. Kun de kalendere, du selv vælger at koble til
            appen, hentes.
          </Box>
          <Box component="li">
            <strong>Læseadgang til din liste af kalendere</strong>{" "}
            (<code>calendar.calendarlist.readonly</code>) — bruges til at vise
            dig en liste, du kan vælge imellem, når du kobler en kalender til et
            familiemedlem.
          </Box>
        </Box>
      </Section>
      <Section title="AI-funktioner">
        Når AI-funktioner i appen bruges (fx forslag til rutiner, indkøb eller et
        ugeresumé), kan relevante aftaletitler, åbne opgaver og indkøbsvarer
        behandles af Cloudflare Workers AI for at danne netop det forslag eller
        resumé, du selv har bedt om. Data fra din Google-konto bruges ikke til
        at træne generelle AI-modeller, og deles ikke med andre tredjeparter end
        Cloudflare, som driver appens serverinfrastruktur.
      </Section>
      <Section title="Deling">
        Et offentligt kalenderlink viser kun de familiemedlemmer og felter, familien
        aktivt vælger. Linket kan tilbagekaldes i appens indstillinger. Data fra din
        Google-konto sælges eller overdrages aldrig til tredjepart, og bruges
        udelukkende til at levere appens funktioner til dig og din familie.
      </Section>
      <Section title="Opbevaring og sikkerhed">
        Serverdata opbevares i Cloudflare D1. Adgangstokens til Google krypteres
        server-side og bruges kun til at hente/opdatere din kalender på dine
        vegne. Forbindelser bruger HTTPS. Lokale præferencer og en begrænset
        cache kan desuden ligge på den enhed, hvor appen bruges.
      </Section>
      <Section title="Dine valg og sletning">
        Du kan til enhver tid afbryde appens adgang til din Google-konto — enten
        fra appens Indstillinger, eller direkte fra din Googlekontos{" "}
        <Box component="a" href="https://myaccount.google.com/permissions" sx={{ color: "inherit" }}>
          sikkerhedsindstillinger
        </Box>
        . Du kan desuden slå notifikationer fra, tilbagekalde delelinks og
        eksportere eller slette dine appdata fra Indstillinger. Ønsker du dine
        data slettet helt, kan du kontakte os som beskrevet nedenfor.
      </Section>
      <Section title="Overholdelse af Googles krav">
        Boholts Familieapps brug og overførsel af information modtaget fra
        Google APIs overholder Google API Services User Data Policy, inklusive
        kravene om Limited Use ("Boholts Family Platform's use and transfer of
        information received from Google APIs to any other app will adhere to
        the Google API Services User Data Policy, including the Limited Use
        requirements.").
      </Section>
      <Section title="Kontakt">
        Spørgsmål om data eller ønske om sletning kan sendes til
        nicolajbach12@gmail.com.
      </Section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <Section title="Om tjenesten">
        Boholts Familieapp er en familieplatform til kalender, opgaver,
        indkøbslister og relaterede påmindelser. Tjenesten er under løbende
        udvikling og kan ændre sig.
      </Section>
      <Section title="Din brug">
        Du er ansvarlig for de oplysninger, du tilføjer eller deler, og for at
        offentlige delelinks kun sendes til de rette modtagere. Misbrug eller
        forsøg på uautoriseret adgang er ikke tilladt.
      </Section>
      <Section title="Eksterne tjenester">
        Google Calendar, Outlook, push-notifikationer og AI-funktioner afhænger af
        eksterne tjenester. Deres tilgængelighed og vilkår kan påvirke appen.
      </Section>
      <Section title="Begrænsning">
        Appen leveres som et praktisk familie-værktøj. Kritiske aftaler og
        påmindelser bør ikke bero på appen alene, da synkronisering eller
        notifikationer kan blive forsinket.
      </Section>
      <Section title="Kontakt">
        Spørgsmål til vilkårene kan sendes til nicolajbach12@gmail.com.
      </Section>
    </>
  );
}
