import {
  CalendarMonthRounded,
  CheckCircleOutlineRounded,
  RestaurantMenuRounded,
  ShoppingCartOutlined,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

// Sprint 48: Nicolaj valgte denne tre-knappers løsning (Google/Microsoft/
// Apple) frem for et magic-link-alternativ — se
// 48_Sprint48_Login_Microsoft_Apple_Kalenderforbindelser_Plan.md. Ikonerne
// er inlinet her (samme SVG'er som i den godkendte mockup), da appen ikke
// har nogen delt brand-ikon-komponent endnu, og de kun bruges dette ene sted.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.7c-.18-.54-.28-1.11-.28-1.7s.1-1.16.28-1.7V4.96H.96C.35 6.17 0 7.55 0 9s.35 2.83.96 4.04l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 170 170" aria-hidden="true">
      <path
        fill="currentColor"
        d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.2-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.93.21-9.84-1.96-14.75-6.52-3.13-2.73-7.04-7.41-11.73-14.04-5.03-7.08-9.17-15.29-12.41-24.65-3.47-10.11-5.21-19.9-5.21-29.38 0-10.86 2.35-20.22 7.05-28.07 3.69-6.3 8.6-11.28 14.75-14.92 6.15-3.65 12.79-5.51 19.95-5.63 3.91 0 9.05 1.21 15.43 3.59 6.36 2.39 10.45 3.6 12.24 3.6 1.34 0 5.88-1.42 13.57-4.24 7.27-2.62 13.42-3.7 18.44-3.27 13.63 1.1 23.87 6.47 30.68 16.15-12.19 7.39-18.22 17.73-18.1 31 .11 10.34 3.86 18.94 11.23 25.77 3.34 3.17 7.07 5.62 11.22 7.36-.9 2.61-1.85 5.11-2.86 7.51zM119.11 7.24c0 8.1-2.96 15.67-8.86 22.67-7.12 8.32-15.73 13.13-25.07 12.38a25.22 25.22 0 0 1-.19-3.07c0-7.78 3.39-16.1 9.4-22.91 3-3.44 6.82-6.31 11.45-8.6 4.62-2.25 8.99-3.5 13.1-3.71.12 1.08.17 2.17.17 3.24z"
      />
    </svg>
  );
}

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <CalendarMonthRounded />,
    title: "Fælles kalender",
    description: "Se familiens aftaler samlet ét sted — synkroniseret med Google og Outlook.",
  },
  {
    icon: <CheckCircleOutlineRounded />,
    title: "Opgaver og rutiner",
    description: "Fordel engangsopgaver og faste rutiner mellem familiens medlemmer.",
  },
  {
    icon: <ShoppingCartOutlined />,
    title: "Indkøbslister",
    description: "Delte, opdaterede lister — alle kan tilføje og krydse af undervejs.",
  },
  {
    icon: <RestaurantMenuRounded />,
    title: "Måltidsplanlægning",
    description: "Planlæg ugens retter, og få automatisk et forslag til indkøb.",
  },
];

// Sprint 44 (Google OAuth-verificering): Googles review afviste den
// tidligere, meget korte udgave af denne side med "home page does not
// explain the purpose of your app" og "home page is behind a login
// page" — se 44_Google_OAuth_Adskillelse_Main_Beta_Plan.md. Denne side
// ER appens uautentificerede forside (AppLayout viser den for enhver
// besøgende uden gyldig session, uanset hvilken sti de kom fra), så den
// skal reelt fungere som en forklarende landingsside, ikke kun en
// login-boks — loginknappen er fortsat med, men er ikke længere det
// eneste indhold på siden.
function LoginPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 4, sm: 8 } }}>
      <Box sx={{ maxWidth: 720, mx: "auto", px: 2 }}>
        <Box sx={{ textAlign: "center", mb: 5 }}>
          <Box
            component="img"
            src="/icon-192.png"
            alt=""
            sx={{ width: 72, height: 72, mb: 2, borderRadius: 3 }}
          />

          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Boholts Familieapp
          </Typography>

          <Typography color="text.secondary" sx={{ maxWidth: 480, mx: "auto" }}>
            En fælles platform for familien: kalender, opgaver, indkøbslister
            og måltidsplanlægning samlet ét sted, så alle i familien kan se
            og planlægge det samme overblik — uanset hvilken enhed de bruger.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            mb: 5,
          }}
        >
          {features.map((feature) => (
            <Card key={feature.title} variant="outlined">
              <CardContent sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
                  {feature.icon}
                </Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{feature.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Card sx={{ maxWidth: 400, mx: "auto" }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontWeight: 600, mb: 2 }}>
              Kom i gang med din families konto
            </Typography>

            <Stack spacing={1.5}>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                href="/auth/google/begin"
                startIcon={<GoogleIcon />}
                sx={{ justifyContent: "center", borderColor: "divider", color: "text.primary" }}
              >
                Fortsæt med Google
              </Button>

              <Button
                variant="outlined"
                size="large"
                fullWidth
                href="/auth/microsoft/begin"
                startIcon={<MicrosoftIcon />}
                sx={{ justifyContent: "center", borderColor: "divider", color: "text.primary" }}
              >
                Fortsæt med Microsoft
              </Button>

              <Box sx={{ position: "relative" }}>
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  disabled
                  startIcon={<AppleIcon />}
                  sx={{ justifyContent: "center", whiteSpace: "nowrap" }}
                >
                  Fortsæt med Apple
                </Button>
                <Chip
                  label="Kommer senere"
                  size="small"
                  sx={{
                    position: "absolute",
                    top: -10,
                    right: 8,
                    bgcolor: "background.paper",
                  }}
                />
              </Box>
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2.5 }}>
              Ved at logge ind accepterer du vores{" "}
              <Link component={RouterLink} to="/terms">vilkår</Link>
              {" "}og kan læse, hvordan vi behandler data i vores{" "}
              <Link component={RouterLink} to="/privacy">privatlivspolitik</Link>.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export default LoginPage;
