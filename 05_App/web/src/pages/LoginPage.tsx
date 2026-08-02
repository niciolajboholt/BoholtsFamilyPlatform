import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
} from "@mui/material";

function LoginPage() {
  // Forespørgselsparameteren gør hvert link unikt, så Cloudflares edge-cache
  // (workers.dev-domænet giver os ingen egen purge-adgang) aldrig kan ramme
  // et tidligere cachet svar for denne rute — den ignoreres af serveren.
  // Beregnes én gang pr. mount, ikke ved hvert render (impure ellers).
  const [cacheBuster] = useState(() => Date.now());

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ maxWidth: 400, width: "100%" }}>
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Familiens fælles kalender
          </Typography>

          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Log ind for at oprette eller deltage i en familie.
          </Typography>

          <Button
            variant="contained"
            size="large"
            fullWidth
            href={`/auth/google/start?_=${cacheBuster}`}
          >
            Log ind med Google
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

export default LoginPage;
