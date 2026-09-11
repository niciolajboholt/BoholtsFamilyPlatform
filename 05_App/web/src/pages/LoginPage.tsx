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
  Link,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

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

            <Button
              variant="contained"
              size="large"
              fullWidth
              href="/auth/google/begin"
            >
              Log ind med Google
            </Button>

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
