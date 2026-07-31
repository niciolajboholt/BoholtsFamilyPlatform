import { useEffect, useState } from "react";

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

import { FamilySetupOnboarding } from "../features/calendar/components/FamilySetupOnboarding";
import { familyPseudoMemberId } from "../features/calendar/models/calendarEvent";
import {
  familyMembersChangedEvent,
  getFamilyMembers,
  hasCompletedFamilySetup,
} from "../features/calendar/preferences/familyMembersStorage";

const routes = ["/", "/calendar", "/settings"];

function readFamilyName(): string {
  return (
    getFamilyMembers().find((member) => member.id === familyPseudoMemberId)
      ?.name ?? "Familien"
  );
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [isFirstLaunch, setIsFirstLaunch] = useState(
    () => !hasCompletedFamilySetup(),
  );
  // Not sourced from useFamilyMembers() — that hook's state is only read
  // once at mount, so it would still show the pre-onboarding placeholder
  // name after onDone() fires, since AppLayout itself never remounts.
  const [familyName, setFamilyName] = useState(() => readFamilyName());

  useEffect(() => {
    document.title = `${familyName} Familieapp`;
  }, [familyName]);

  // Renaming the family in Settings saves through a separate
  // useFamilyMembers() instance, which doesn't share state with this
  // component — pick up the change without requiring a full page reload.
  useEffect(() => {
    function handleFamilyMembersChanged() {
      setFamilyName(readFamilyName());
    }

    window.addEventListener(
      familyMembersChangedEvent,
      handleFamilyMembersChanged,
    );
    return () =>
      window.removeEventListener(
        familyMembersChangedEvent,
        handleFamilyMembersChanged,
      );
  }, []);

  if (isFirstLaunch) {
    return (
      <FamilySetupOnboarding
        onDone={() => {
          setFamilyName(readFamilyName());
          setIsFirstLaunch(false);
        }}
      />
    );
  }

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
              {familyName.trim().slice(0, 1).toUpperCase() || "?"}
            </Box>

            <Box>
              <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                {familyName}
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