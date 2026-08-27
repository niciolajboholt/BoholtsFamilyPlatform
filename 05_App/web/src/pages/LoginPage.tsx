import {
  Box,
  Button,
  Card,
  CardContent,
  Link,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

function LoginPage() {
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
          <Box
            component="img"
            src="/icon-192.png"
            alt=""
            sx={{ width: 72, height: 72, mb: 1.5, borderRadius: 3 }}
          />

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Boholts Familieapp
          </Typography>

          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Kalender, opgaver og indkøb samlet ét sted for familien.
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
  );
}

export default LoginPage;
