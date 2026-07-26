import {
  CalendarMonthRounded,
  ChevronRightRounded,
  DarkModeRounded,
  FamilyRestroomRounded,
  NotificationsRounded,
  PersonRounded,
  SyncRounded,
} from "@mui/icons-material";

import {
  Avatar,
  Box,
  Card,
  CardContent,
  Divider,
  IconButton,
  Switch,
  Typography,
} from "@mui/material";

const familyMembers = [
  {
    name: "Nicolaj",
    role: "Forælder",
    initials: "N",
    color: "#2E7D32",
  },
  {
    name: "Christine",
    role: "Forælder",
    initials: "C",
    color: "#C06C84",
  },
  {
    name: "Alfred",
    role: "Barn",
    initials: "A",
    color: "#D99832",
  },
  {
    name: "Jens",
    role: "Barn",
    initials: "J",
    color: "#4D7EA8",
  },
];

function SettingsPage() {
  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Indstillinger</Typography>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Administrer familie, kalendere og appens indstillinger.
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gap: 2.5 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                mb: 2.5,
              }}
            >
              <Avatar sx={{ bgcolor: "primary.main" }}>
                <FamilyRestroomRounded />
              </Avatar>

              <Box>
                <Typography variant="h6">Familien</Typography>

                <Typography variant="body2" color="text.secondary">
                  Administrer familiens profiler
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: "grid", gap: 0 }}>
              {familyMembers.map((member, index) => (
                <Box key={member.name}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      py: 1.5,
                    }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: member.color,
                        width: 42,
                        height: 42,
                        fontWeight: 700,
                      }}
                    >
                      {member.initials}
                    </Avatar>

                    <Box sx={{ flexGrow: 1 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {member.name}
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        {member.role}
                      </Typography>
                    </Box>

                    <IconButton aria-label={`Rediger ${member.name}`}>
                      <ChevronRightRounded />
                    </IconButton>
                  </Box>

                  {index < familyMembers.length - 1 && <Divider />}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                mb: 2.5,
              }}
            >
              <Avatar sx={{ bgcolor: "secondary.main" }}>
                <CalendarMonthRounded />
              </Avatar>

              <Box>
                <Typography variant="h6">Kalenderforbindelser</Typography>

                <Typography variant="body2" color="text.secondary">
                  Saml familiens eksterne kalendere
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.5,
              }}
            >
              <Avatar
                sx={{
                  bgcolor: "background.default",
                  color: "text.primary",
                }}
              >
                <SyncRounded />
              </Avatar>

              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  Google Calendar
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Ikke forbundet endnu
                </Typography>
              </Box>

              <IconButton aria-label="Administrer Google Calendar">
                <ChevronRightRounded />
              </IconButton>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Appindstillinger
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.5,
              }}
            >
              <NotificationsRounded color="action" />

              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  Notifikationer
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Påmindelser om aftaler og opgaver
                </Typography>
              </Box>

              <Switch defaultChecked />
            </Box>

            <Divider />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.5,
              }}
            >
              <DarkModeRounded color="action" />

              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  Mørkt tema
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Forberedt til en senere sprint
                </Typography>
              </Box>

              <Switch disabled />
            </Box>

            <Divider />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.5,
              }}
            >
              <PersonRounded color="action" />

              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  Min profil
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Nicolaj
                </Typography>
              </Box>

              <IconButton aria-label="Åbn min profil">
                <ChevronRightRounded />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export default SettingsPage;