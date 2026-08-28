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

function Section({ title, children }: { title: string; children: string }) {
  return (
    <Box component="section" sx={{ mb: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>{title}</Typography>
      <Typography color="text.secondary">{children}</Typography>
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
      <Section title="Kalendere og AI">
        Kalenderdata hentes fra de tjenester, du selv forbinder. Når AI-funktioner
        bruges, kan relevante aftaletitler, åbne opgaver og indkøbsvarer behandles
        af Cloudflare Workers AI for at danne et forslag eller et ugeresumé.
      </Section>
      <Section title="Deling">
        Et offentligt kalenderlink viser kun de familiemedlemmer og felter, familien
        aktivt vælger. Linket kan tilbagekaldes i appens indstillinger.
      </Section>
      <Section title="Opbevaring og sikkerhed">
        Serverdata opbevares i Cloudflare D1. Login-tokens beskyttes server-side,
        og forbindelser bruger HTTPS. Lokale præferencer og en begrænset cache kan
        desuden ligge på den enhed, hvor appen bruges.
      </Section>
      <Section title="Dine valg">
        Du kan afbryde kalenderforbindelser, slå notifikationer fra, tilbagekalde
        delelinks og eksportere lokale appdata fra Indstillinger.
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
