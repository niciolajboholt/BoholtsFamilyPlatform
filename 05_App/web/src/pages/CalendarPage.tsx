import {
  AddRounded,
  CalendarMonthRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";

const appointments = [
  {
    time: "08:00",
    title: "Aflevering",
    description: "Alfred i skole og Jens i børnehave",
    color: "#D99832",
    initials: "A",
  },
  {
    time: "15:30",
    title: "Hentning",
    description: "Christine henter Alfred",
    color: "#C06C84",
    initials: "C",
  },
  {
    time: "17:00",
    title: "Familietid",
    description: "Hele familien",
    color: "#2E7D32",
    initials: "F",
  },
];

function CalendarPage() {
  const currentDate = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4">Kalender</Typography>

          <Typography
            color="text.secondary"
            sx={{ mt: 0.5, textTransform: "capitalize" }}
          >
            {currentDate}
          </Typography>
        </Box>

        <Button variant="contained" startIcon={<AddRounded />}>
          Ny aftale
        </Button>
      </Box>

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <IconButton aria-label="Forrige dag">
              <ChevronLeftRounded />
            </IconButton>

            <Stack
              sx={{
                alignItems: "center",
                gap: 0.5,
              }}
            >
              <Avatar
                sx={{
                  bgcolor: "primary.main",
                  width: 44,
                  height: 44,
                }}
              >
                <CalendarMonthRounded />
              </Avatar>

              <Typography sx={{ fontWeight: 700 }}>I dag</Typography>
            </Stack>

            <IconButton aria-label="Næste dag">
              <ChevronRightRounded />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      <Stack sx={{ gap: 2 }}>
        {appointments.map((appointment) => (
          <Card key={`${appointment.time}-${appointment.title}`}>
            <CardContent sx={{ p: 2.5 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "64px 1fr",
                    sm: "80px 1fr auto",
                  },
                  gap: 2,
                  alignItems: "center",
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    color: "text.secondary",
                  }}
                >
                  {appointment.time}
                </Typography>

                <Box>
                  <Typography variant="h6">
                    {appointment.title}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    {appointment.description}
                  </Typography>
                </Box>

                <Chip
                  avatar={
                    <Avatar
                      sx={{
                        bgcolor: appointment.color,
                        color: "#fff",
                      }}
                    >
                      {appointment.initials}
                    </Avatar>
                  }
                  label={appointment.description}
                  sx={{
                    display: { xs: "none", sm: "flex" },
                    justifySelf: "end",
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Card sx={{ mt: 2.5, border: "1px dashed", borderColor: "divider" }}>
        <CardContent sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="h6">Flere kalenderkilder kommer senere</Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.75 }}
          >
            Her bliver Google Calendar og familiens interne kalendere samlet.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default CalendarPage;