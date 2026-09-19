import type { ReactNode } from "react";

import { ArrowBackRounded } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

interface LegalPageProps {
  kind: "privacy" | "terms";
}

const updatedAt = "19. september 2026";

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
        Appen gemmer din profil (fra Google eller Microsoft), familiemedlemskab,
        opgaver og rutiner, indkøbslister, måltidsplaner, fødselsdage og
        gaveidéer, opgavebelønninger (lommepenge), fællesøkonomi mellem
        forældre, kalenderkoblinger, notifikationsabonnementer og de
        indstillinger, der er nødvendige for at levere funktionerne. Data
        gemmes pr. familie — kun familiens egne medlemmer og de, familien
        aktivt vælger at dele et kalenderlink med, kan se dem.
      </Section>
      <Section title="Login">
        <Typography color="text.secondary" component="span" sx={{ display: "block", mb: 1.5 }}>
          Appen understøtter to login-metoder i dag. Begge bruges udelukkende
          til at oprette og genkende din konto — ingen af dem giver appen
          adgang til andet i din Google- eller Microsoft-konto, end det der
          er beskrevet her.
        </Typography>
        <Box component="ul" sx={{ color: "text.secondary", m: 0, pl: 3 }}>
          <Box component="li">
            <strong>Google</strong> — din grundlæggende profil (navn,
            e-mailadresse, profilbillede).
          </Box>
          <Box component="li">
            <strong>Microsoft</strong> — din grundlæggende profil (navn,
            e-mailadresse), hentet via server-side OAuth (authorization
            code + PKCE).
          </Box>
        </Box>
        <Typography color="text.secondary" component="span" sx={{ display: "block", mt: 1.5 }}>
          Login med Apple er planlagt, men endnu ikke bygget — knappen på
          login-siden er bevidst inaktiv indtil da.
        </Typography>
      </Section>
      <Section title="Børneadgang uden konto">
        Et familiemedlem (fx et barn) kan i stedet få adgang til sin egen
        "Mit i dag"-visning på en separat enhed, uden at logge ind med Google
        eller Microsoft. Det kræver et unikt link, som kun familiens ejer
        eller admin kan oprette og dele, samt en 4-cifret kode, som ejeren
        eller admin sætter for det pågældende familiemedlem. Denne adgang
        viser og lader kun barnet afkrydse sine egne opgaver den pågældende
        dag — intet andet i appen, og ingen andre familiemedlemmers data.
        Koden gemmes aldrig i klartekst, kun kryptografisk hashet. Ejeren
        eller admin kan til enhver tid tilbagekalde eller udskifte linket,
        hvorved enhver aktiv adgang for barnet øjeblikkeligt ophører.
      </Section>
      <Section title="Kalenderintegrationer">
        <Typography color="text.secondary" component="span" sx={{ display: "block", mb: 1.5 }}>
          Du vælger selv, hvilke eksterne kalendere der kobles til appen — der
          hentes aldrig kalendere, du ikke selv har valgt.
        </Typography>
        <Box component="ul" sx={{ color: "text.secondary", m: 0, pl: 3 }}>
          <Box component="li">
            <strong>Google Kalender</strong> — læse- og skriveadgang
            (<code>calendar.events</code>) samt læseadgang til din liste af
            kalendere (<code>calendar.calendarlist.readonly</code>), brugt
            til at vise, oprette, redigere og slette aftaler i de kalendere,
            du vælger at koble til et familiemedlem.
          </Box>
          <Box component="li">
            <strong>Microsoft/Outlook Kalender</strong> — koden findes i
            appen, men integrationen er for øjeblikket midlertidigt slået
            fra på grund af en administrativ begrænsning hos den anvendte
            Azure-app-registrering, og henter derfor ikke aktivt data lige
            nu. Denne politik opdateres, når integrationen genaktiveres.
          </Box>
          <Box component="li">
            <strong>iCloud-kalender (CalDAV)</strong> — kræver at du selv
            opretter en Apple-appspecifik adgangskode og indtaster den i
            appen. Adgangskoden krypteres server-side (samme metode som
            Google-adgangstokens, se "Opbevaring og sikkerhed") og bruges
            kun til at hente/opdatere de iCloud-kalendere, du vælger.
          </Box>
          <Box component="li">
            <strong>ICS-kalenderabonnementer</strong> — et offentligt
            ICS-link, du selv indsætter (fx en skole- eller
            foreningskalender), hentes periodisk read-only. Ingen
            login-oplysninger udveksles for denne kalendertype.
          </Box>
        </Box>
      </Section>
      <Section title="Opgaver, indkøb, måltider, fødselsdage og fællesøkonomi">
        Opgaver og faste rutiner, indkøbslister og -skabeloner, måltidsplaner,
        fødselsdage og tilhørende gaveidéer, opgavebelønning (en lommepenge-
        saldo pr. barn) og fællesøkonomi mellem forældre (delte udgifter og
        opgørelse) gemmes i appens database, knyttet til din familie. Disse
        data deles ikke uden for familien og bruges ikke til andet end at
        levere funktionerne.
      </Section>
      <Section title="Push-notifikationer">
        Hvis du aktiverer notifikationer, gemmer appen et push-abonnement
        (en unik endpoint-URL og krypteringsnøgler leveret af din browser,
        ikke personlige oplysninger) for at kunne sende dig beskeder om nye
        eller ændrede aftaler, opgaver, indkøb og påmindelser. Du kan slå
        notifikationer fra i Indstillinger, hvilket sletter abonnementet.
      </Section>
      <Section title="AI-funktioner">
        Når AI-funktioner i appen bruges (fx forslag til rutiner, indkøb eller et
        ugeresumé), kan relevante aftaletitler, åbne opgaver og indkøbsvarer
        behandles af{" "}
        <Box component="a" href="https://developers.cloudflare.com/workers-ai/" sx={{ color: "inherit" }}>
          Cloudflare Workers AI
        </Box>{" "}
        (modellen GLM-4.7-flash fra Zhipu AI/Z.ai, kørende på Cloudflares egen
        infrastruktur) for at danne netop det forslag eller resumé, du selv har
        bedt om. Ifølge{" "}
        <Box component="a" href="https://developers.cloudflare.com/workers-ai/platform/data-usage/" sx={{ color: "inherit" }}>
          Cloudflares egen databehandlingspolitik
        </Box>
        {" "}bruger Cloudflare ikke denne data til at træne AI-modeller eller
        forbedre egne eller tredjeparters tjenester, medmindre der udtrykkeligt
        er givet samtykke til det — det har vi ikke givet. Data forlader ikke
        Cloudflares infrastruktur og deles ikke med Zhipu AI/Z.ai eller andre
        tredjeparter. AI-funktioner kan slås fra pr. familie i Indstillinger.
      </Section>
      <Section title="Lokale caches og offline-data">
        Appen gemmer nogle data lokalt på den enhed, du bruger (browserens
        localStorage): dine visningsindstillinger, en cache af kalenderaftaler
        til hurtigere indlæsning og offline-visning, kalender-til-medlem-
        koblinger, og en manuel sikkerhedskopi, hvis du selv opretter en (se
        "Eksport af data" nedenfor). Disse data forlader ikke enheden og
        synkroniseres ikke automatisk mellem devices — de ryddes automatisk
        ved log ud.
      </Section>
      <Section title="Offentlige delelinks">
        Et familiemedlem kan oprette et offentligt, uautentificeret link, der
        viser udvalgte familiemedlemmers kalenderaftaler til modtagere uden
        login — kun de medlemmer og felter, familien aktivt vælger at vise,
        er synlige via linket. Linket kan til enhver tid tilbagekaldes i
        appens Indstillinger, hvorefter det øjeblikkeligt holder op med at
        virke.
      </Section>
      <Section title="Opbevaring og sikkerhed">
        Serverdata opbevares i Cloudflare D1. Adgangstokens til Google og
        Microsoft samt din iCloud-appspecifikke adgangskode krypteres
        server-side og bruges kun til at hente/opdatere din kalender på dine
        vegne. Al trafik til og fra appen sker over HTTPS.
      </Section>
      <Section title="Eksport af data">
        Du kan downloade en lokal sikkerhedskopi fra Indstillinger
        ("Data & backup"). Den indeholder de indstillinger og den
        kalender-cache, der ligger på din egen enhed (se "Lokale caches og
        offline-data" ovenfor). Samme sted kan et familiemedlem downloade
        en maskinlæsbar kopi af sine egne serverdata. Familiens ejer kan
        downloade familiens delte data, inklusive medlemmernes navn og
        e-mail. Eksporten indeholder ikke adgangstokens, adgangskoder,
        sessionsdata, aktive delelinktokens eller fulde hemmelige
        kalenderabonnements-links; for forbindelser medtages kun sikker
        metadata. Du kan også kontakte os som beskrevet under "Kontakt",
        hvis du har spørgsmål til eller brug for hjælp med en eksport.
      </Section>
      <Section title="Dine valg og sletning">
        Du kan til enhver tid afbryde appens adgang til din Google- eller
        Microsoft-konto — enten fra appens Indstillinger, eller direkte fra
        kontoens egne sikkerhedsindstillinger (
        <Box component="a" href="https://myaccount.google.com/permissions" sx={{ color: "inherit" }}>
          Google
        </Box>
        {" / "}
        <Box component="a" href="https://account.live.com/consent/Manage" sx={{ color: "inherit" }}>
          Microsoft
        </Box>
        ). Du kan desuden slå notifikationer fra, fjerne en iCloud- eller
        ICS-kalenderforbindelse, og tilbagekalde delelinks — alt sammen fra
        Indstillinger. At fjerne en kalenderforbindelse sletter kun appens
        egen kobling (token/mapping); selve kalenderdata hos Google,
        Microsoft eller Apple berøres ikke. Fra Indstillinger kan du også
        anmode om at få din konto slettet. Det kræver en frisk bekræftelse
        af din Google- eller Microsoft-identitet og en eksplicit
        bekræftelsestekst. Ejer du en aktiv familie, skal du først overdrage
        ejerskabet eller vælge det særskilte flow til at slette hele
        familien. Kontoen eller familien skjules med det samme, men kan
        gendannes i 30 dage; derefter anonymiseres kontoen eller familiens
        data slettes permanent. Historiske opgaver og udgifter, som andre
        familiemedlemmer fortsat bruger, bevares med afsenderen vist som
        "Tidligere medlem". Sletning i Hjemmecentralen ændrer ikke dine
        kalenderdata hos Google, Microsoft eller Apple.
      </Section>
      <Section title="Overholdelse af Googles krav">
        Hjemmecentralens (tidligere Boholts Family Platforms) brug og
        overførsel af information modtaget fra Google APIs overholder Google
        API Services User Data Policy, inklusive kravene om Limited Use
        ("Boholts Family Platform's use and transfer of information received
        from Google APIs to any other app will adhere to the Google API
        Services User Data Policy, including the Limited Use requirements.").
        Denne engelske erklæring gengives ordret, uændret, som godkendt af
        Google ved appens OAuth-verificering.
      </Section>
      <Section title="Dataansvarlig og kontakt">
        Dataansvarlig for Hjemmecentralen er Nicolaj Bach Boholt. Spørgsmål om
        data, eller ønske om eksport eller sletning, kan sendes til
        nicolajbach12@gmail.com.
      </Section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <Section title="Om tjenesten">
        Hjemmecentralen er en familieplatform til kalender, opgaver, rutiner,
        indkøbslister, måltidsplanlægning, fødselsdage/gaveplaner,
        opgavebelønning og fællesøkonomi mellem forældre. Tjenesten er under
        løbende udvikling og kan ændre sig.
      </Section>
      <Section title="Din brug">
        Du er ansvarlig for de oplysninger, du tilføjer eller deler, og for at
        offentlige delelinks og børneadgangs-links kun deles med de rette
        modtagere. Misbrug eller forsøg på uautoriseret adgang er ikke
        tilladt.
      </Section>
      <Section title="Eksterne tjenester">
        Google-, Microsoft- og iCloud-kalenderintegration, ICS-kalender-
        abonnementer, push-notifikationer og AI-funktioner afhænger af
        eksterne tjenester (herunder Google, Microsoft, Apple og Cloudflare
        Workers AI). Deres tilgængelighed, vilkår og eventuelle midlertidige
        driftsafbrydelser kan påvirke appens funktioner — fx er
        Outlook-kalenderintegrationen for øjeblikket midlertidigt slået fra,
        se privatlivspolitikken.
      </Section>
      <Section title="Dataeksport og -sletning">
        Du kan downloade en lokal sikkerhedskopi af dine enheds-indstillinger
        samt en rollebegrænset eksport af serverdata fra Indstillinger. Du
        kan samme sted anmode om sletning af din konto, og familiens ejer kan
        anmode om sletning af hele familien. Destruktive handlinger kræver
        frisk genautentificering og eksplicit bekræftelse og har 30 dages
        fortrydelsesperiode. Se privatlivspolitikkens afsnit "Eksport af
        data" og "Dine valg og sletning" for omfang og undtagelser.
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
