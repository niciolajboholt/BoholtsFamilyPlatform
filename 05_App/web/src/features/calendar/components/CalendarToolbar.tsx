import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
} from "@mui/material";

interface CalendarToolbarProps {
  visibleMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function CalendarToolbar({
  visibleMonth,
  onPreviousMonth,
  onNextMonth,
  onToday,
}: CalendarToolbarProps) {
  return (
    <Card sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "auto 1fr auto",
            },
            alignItems: "center",
            gap: 2,
          }}
        >
          <Button
            variant="outlined"
            onClick={onPreviousMonth}
          >
            ← Forrige
          </Button>

          <Box sx={{ textAlign: "center" }}>
            <Typography
              variant="h5"
              sx={{
                textTransform: "capitalize",
                fontWeight: 700,
              }}
            >
              {formatMonth(visibleMonth)}
            </Typography>

            <Button
              size="small"
              onClick={onToday}
              sx={{ mt: 0.5 }}
            >
              Gå til i dag
            </Button>
          </Box>

          <Button
            variant="outlined"
            onClick={onNextMonth}
          >
            Næste →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default CalendarToolbar;