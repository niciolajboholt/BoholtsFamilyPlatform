import { useEffect, useRef, useState } from "react";

import {
  CalendarMonthRounded,
  CheckCircleOutlineRounded,
  HomeRounded,
  SettingsRounded,
  ShoppingCartOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  CircularProgress,
  Container,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
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

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { path: "/", label: "Overblik", icon: <HomeRounded /> },
  { path: "/calendar", label: "Kalender", icon: <CalendarMonthRounded /> },
  { path: "/shopping-list", label: "Indkøb", icon: <ShoppingCartOutlined /> },
  { path: "/tasks", label: "Opgaver", icon: <CheckCircleOutlineRounded /> },
  { path: "/settings", label: "Indstillinger", icon: <SettingsRounded /> },
];

const routes = navItems.map((item) => item.path);

const sidebarWidth = 220;

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

  // Komplementet til effekten ovenfor: den springer bevidst netværkskaldet
  // over for returnerende brugere (isFirstLaunch=false), men det samme kald
  // er den ENESTE kilde til getFamilyPseudoMemberServerId()'s cache i
  // familyMembersStorage.ts — en ren in-memory-værdi, der nulstilles ved
  // hver sideindlæsning. Uden dette forblev pseudomedlemmets rigtige
  // server-id "unset" for enhver returnerende bruger, indtil de tilfældigvis
  // gemte en anden familiemedlem-redigering først — hvilket gjorde
  // kalender-tildeling til "Familien" stille (nu synligt, se
  // FamilyMemberDialog) defekt for netop den mest almindelige brugssituation.
  useEffect(() => {
    if (!user || isFirstLaunch) {
      return;
    }

    let isCancelled = false;

    getMyFamily().then((result) => {
      if (!isCancelled && result.ok && result.data.family && result.data.members) {
        syncFamilyMembersFromServer(result.data.members);
        setFamilyName(readFamilyName());
      }
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

  // Sprint 29: routes dækker fem sider — Math.max(...,0) fik /tasks og
  // /shopping-list til fejlagtigt at vise "Overblik" som valgt. -1 matcher
  // ingen af navigationens punkter, så MUI viser korrekt ingen fane som
  // valgt.
  const currentIndex = routes.indexOf(location.pathname);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <AppBar
        ref={appBarRef}
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          bgcolor: (theme) => alpha(theme.palette.background.default, 0.92),
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
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
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex" }}>
        {/* Desktop/tablet: fast venstremenu i stedet for den flydende
            bundmenu, som på større skærme både så malplaceret ud og kunne
            dække indhold nederst på siden (fx kalender og indstillinger). */}
        <Box
          component="nav"
          sx={{
            display: { xs: "none", sm: "block" },
            width: sidebarWidth,
            flexShrink: 0,
            position: "sticky",
            top: "var(--app-bar-height, 64px)",
            alignSelf: "flex-start",
            height: "calc(100vh - var(--app-bar-height, 64px))",
            borderRight: "1px solid",
            borderColor: "divider",
            py: 2,
          }}
        >
          <List sx={{ px: 1.5 }}>
            {navItems.map((item, index) => {
              const isSelected = index === currentIndex;

              return (
                <ListItemButton
                  key={item.path}
                  selected={isSelected}
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    "&.Mui-selected": {
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      "&:hover": { bgcolor: "primary.dark" },
                      "& .MuiListItemIcon-root": {
                        color: "primary.contrastText",
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isSelected ? "inherit" : "text.secondary",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>

                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        sx: { fontWeight: isSelected ? 700 : 500 },
                      },
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        <Container
          component="main"
          maxWidth="md"
          sx={{
            pt: { xs: 3, sm: 4 },
            px: { xs: 2, sm: 3 },
            // Rundhåndet plads under indholdet, så den flydende bundmenu på
            // mobil aldrig dækker sidste kort/knap — desktop har ingen
            // flydende menu og behøver derfor ikke dette.
            pb: { xs: 12, sm: 4 },
          }}
        >
          <Outlet />
        </Container>
      </Box>

      <Paper
        elevation={8}
        sx={{
          display: { xs: "block", sm: "none" },
          position: "fixed",
          left: "50%",
          bottom: 12,
          transform: "translateX(-50%)",
          width: "calc(100% - 24px)",
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
              borderRadius: 2,
              mx: 0.5,
              "&.Mui-selected": {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              },
            },
            "& .Mui-selected": {
              color: "primary.main",
            },
          }}
        >
          {navItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

export default AppLayout;