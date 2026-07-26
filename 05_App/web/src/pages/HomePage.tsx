import {
  AddRounded,
  CalendarMonthRounded,
  CheckCircleOutlineRounded,
  ChevronRightRounded,
  FamilyRestroomRounded,
  ShoppingCartOutlined,
} from "@mui/icons-material";

import { useNavigate } from "react-router-dom";

import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Typography,
} from "@mui/material";

const familyMembers = [
  {
    name: "Nicolaj",
    initials: "N",
    color: "#2E7D32",
    status: "Arbejde indtil 16:00",
  },
  {
    name: "Christine",
    initials: "C",
    color: "#C06C84",
    status: "Henter Alfred",
  },
  {
    name: "Alfred",
    initials: "A",
    color: "#D99832",
    status: "Skole",
  },
  {
    name: "Jens",
    initials: "J",
    color: "#4D7EA8",
    status: "Børnehave",
  },
];

const quickActions = [
  {
    title: "Ny aftale",
    icon: <AddRounded />,
  },
  {
    title: "Indkøbsliste",
    icon: <ShoppingCartOutlined />,
  },
  {
    title: "Opgaver",
    icon: <CheckCircleOutlineRounded />,
  },
];

function HomePage() {
  const navigate = useNavigate();
  const currentDate = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Hej Nicolaj 👋</Typography>

        <Typography
          color="text.secondary"
          sx={{ mt: 0.5, textTransform: "capitalize" }}
        >
          {currentDate}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "7fr 5fr",
          },
          gap: 2.5,
        }}
      >
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                mb: 2,
              }}
            >
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Næste aftale
                </Typography>

                <Typography variant="h5">Familietid</Typography>
              </Box>

              <Avatar
                sx={{
                  bgcolor: "primary.main",
                  width: 46,
                  height: 46,
                }}
              >
                <CalendarMonthRounded />
              </Avatar>
            </Box>

            <Typography color="text.secondary">
              I dag · 17:00–19:00
            </Typography>

            <Chip
              icon={<FamilyRestroomRounded />}
              label="Hele familien"
              sx={{ mt: 1.5 }}
            />

            <Box>
              <Button
               variant="text"
                endIcon={<ChevronRightRounded />}
                onClick={() => navigate("/calendar")}
                sx={{ mt: 1, px: 0 }}
              >
                Se i kalenderen
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              I dag
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 600 }}>08:00</Typography>

              <Typography color="text.secondary">
                Aflevering i skole og børnehave
              </Typography>
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 600 }}>17:00</Typography>

              <Typography color="text.secondary">
                Familietid
              </Typography>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2.5,
              }}
            >
              <Box>
                <Typography variant="h6">Familien</Typography>

                <Typography variant="body2" color="text.secondary">
                  Dagens planer samlet ét sted
                </Typography>
              </Box>

              <IconButton
                aria-label="Se familien"
                onClick={() => navigate("/settings")}
              >
                <ChevronRightRounded />
              </IconButton>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(4, 1fr)",
                },
                gap: 2,
              }}
            >
              {familyMembers.map((member) => (
                <Box
                  key={member.name}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: 1,
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: member.color,
                      width: 52,
                      height: 52,
                      fontWeight: 700,
                    }}
                  >
                    {member.initials}
                  </Avatar>

                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>
                      {member.name}
                    </Typography>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {member.status}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Hurtige handlinger
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, 1fr)",
              },
              gap: 1.5,
            }}
          >
            {quickActions.map((action) => (
              <Button
                key={action.title}
                fullWidth
                variant="outlined"
                startIcon={action.icon}
                onClick={() => {
                  if (action.title === "Ny aftale") {
                    navigate("/calendar");
                  }
                }}
                sx={{
                  justifyContent: "flex-start",
                  py: 1.5,
                  bgcolor: "background.paper",
                }}
              >
                {action.title}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default HomePage;