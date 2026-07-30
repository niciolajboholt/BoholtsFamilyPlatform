import {
  CalendarMonthRounded,
  HomeRounded,
  SettingsRounded,
} from "@mui/icons-material";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Container,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const routes = ["/", "/calendar", "/settings"];

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentIndex = Math.max(routes.indexOf(location.pathname), 0);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        pb: 10,
      }}
    >
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          bgcolor: "rgba(247, 248, 250, 0.92)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar>
          <Container
            maxWidth="md"
            disableGutters
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 3,
                bgcolor: "primary.main",
                color: "primary.contrastText",
                display: "grid",
                placeItems: "center",
                mr: 1.5,
                fontWeight: 800,
              }}
            >
              B
            </Box>

            <Box>
              <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                Boholts Familie
              </Typography>

              <Typography variant="caption" color="text.secondary">
                Familiens fælles overblik
              </Typography>
            </Box>
          </Container>
        </Toolbar>
      </AppBar>

      <Container
        component="main"
        maxWidth="md"
        sx={{
          pt: { xs: 3, sm: 4 },
          px: { xs: 2, sm: 3 },
        }}
      >
        <Outlet />
      </Container>

      <Paper
        elevation={8}
        sx={{
          position: "fixed",
          left: "50%",
          bottom: { xs: 12, sm: 20 },
          transform: "translateX(-50%)",
          width: {
            xs: "calc(100% - 24px)",
            sm: 480,
          },
          borderRadius: 4,
          overflow: "hidden",
          zIndex: 1200,
        }}
      >
        <BottomNavigation
          showLabels
          value={currentIndex}
          onChange={(_event, newValue: number) => {
            navigate(routes[newValue]);
          }}
          sx={{
            height: 68,
            "& .MuiBottomNavigationAction-root": {
              minWidth: 0,
            },
            "& .Mui-selected": {
              color: "primary.main",
            },
          }}
        >
          <BottomNavigationAction label="Overblik" icon={<HomeRounded />} />

          <BottomNavigationAction
            label="Kalender"
            icon={<CalendarMonthRounded />}
          />

          <BottomNavigationAction
            label="Indstillinger"
            icon={<SettingsRounded />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

export default AppLayout;