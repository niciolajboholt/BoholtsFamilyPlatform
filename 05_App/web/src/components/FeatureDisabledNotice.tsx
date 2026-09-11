import { Box, Typography } from "@mui/material";

// Vises i stedet for en sides indhold, hvis brugeren navigerer direkte til
// en URL for en funktion, familien har slået fra under Indstillinger →
// Flere funktioner — nav-punktet er allerede skjult, men selve ruten er
// stadig nåbar direkte, så siden skal ikke vise tomt eller fejle.
export function FeatureDisabledNotice() {
  return (
    <Box sx={{ maxWidth: 480, mx: "auto", textAlign: "center", py: 8 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Denne funktion er ikke slået til
      </Typography>
      <Typography color="text.secondary">
        Bed en ejer eller admin om at aktivere den under Indstillinger →
        Flere funktioner.
      </Typography>
    </Box>
  );
}
