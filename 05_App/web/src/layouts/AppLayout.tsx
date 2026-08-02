import { useEffect, useRef, useState } from "react";

import {
  CalendarMonthRounded,
  HomeRounded,
  SettingsRounded,
} from "@mui/icons-material";
import {
  AppBar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  CircularProgress,
  Container,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { FamilySetupOnboarding } from "../features/calendar/components/FamilySetupOnboarding";
import { useSession } from "../features/auth/hooks/useSession";
import { familyPseudoMemberId } from "../features/calendar/models/calendarEvent";
import {
  familyMembersChangedEvent,
  getFamilyMembers,
  hasCompletedFamilySetup,
} from "../features/calendar/preferences/familyMembersStorage";
import { getMyFamily } from "../features/family/familyApi";
import { syncFamilyMembersFromServer } from "../features/family/familyMembersSync";
import LoginPage from "../pages/LoginPage";

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

  const { user, isLoading: isSessionLoading } = useSession();

  const [isFirstLaunch, setIsFirstLaunch] = useState(
    () => !hasCompletedFamilySetup(),
  );
  // Not sourced from useFamilyMembers() — that hook's state is only read
  // once at mount, so it would still show the pre-onboarding placeholder
  // name after onDone() fires, since AppLayout itself never remounts.
  const [familyName, setFamilyName] = useState(() => readFamilyName());

  // Kun relevant, hvis DENNE enhed aldrig har gennemført onboarding lokalt —
  // en bruger, der allerede har en familie på serveren (fx logger ind på et
  // nyt device), skal ikke vises onboarding igen, bare fordi den lokale
  // cache er tom. Returnerende brugere med lokal data undgår bevidst dette
  // netværkskald ved hvert opstart.
  const [isFamilyCheckLoading, setIsFamilyCheckLoading] = useState(isFirstLaunch);

  useEffect(() => {
    if (!user || !isFirstLaunch) {
      return;
    }

    let isCancelled = false;

    getMyFamily().then((result) => {
      if (isCancelled) {
        return;
      }

      if (result.ok && result.data.family && result.data.members) {
        syncFamilyMembersFromServer(result.data.members);
        setFamilyName(readFamilyName());
        setIsFirstLaunch(false);
      }

      setIsFamilyCheckLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [user, isFirstLaunch]);

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

  const appBarRef = useRef<HTMLElement>(null);

  // Gør AppBar'ens faktiske (målte, ikke antagede) højde tilgængelig som en
  // CSS-variabel — den er højere end MUI's standard Toolbar-højde, fordi den
  // indeholder to tekstlinjer + et ikon. Sider med egne klæbende
  // overskrifter (fx familie-planlæggeren) skal placeres under AppBar'en og
  // læser derfor denne variabel i stedet for at gætte et fast pixeltal.
  useEffect(() => {
    const appBar = appBarRef.current;

    if (!appBar) {
      return;
    }

    const updateHeight = () => {
      document.documentElement.style.setProperty(
        "--app-bar-height",
        `${appBar.getBoundingClientRect().height}px`,
      );
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(appBar);
    return () => observer.disconnect();
  }, []);

  if (isSessionLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (isFamilyCheckLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

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
        ref={appBarRef}
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