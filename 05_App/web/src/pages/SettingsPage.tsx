import { useState } from "react";

import { Box, Tab, Tabs, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { AccountDataSection } from "../features/settings/components/AccountDataSection";
import { AppNotificationsSection } from "../features/settings/components/AppNotificationsSection";
import { BirthdaysSection } from "../features/settings/components/BirthdaysSection";
import { CalendarConnectionsSection } from "../features/settings/components/CalendarConnectionsSection";
import { FamilySection } from "../features/settings/components/FamilySection";
import { HelpFeedbackSection } from "../features/settings/components/HelpFeedbackSection";
import { SharedExpensesSection } from "../features/settings/components/SharedExpensesSection";

// Sprint 57 (se 57_Sprint57_Sammenhaeng_Hastighed_UX_Plan.md, afsnit I):
// Indstillinger var vokset til 7 sektioner i ét fladt, lodret grid — svært
// at overskue, og hver sektion monterede (og hentede sin egen data)
// samtidig, uanset om brugeren nogensinde så den. Opdelt i faner ud fra
// opgavens 5 minimumskategorier, uden at ændre nogen sektions interne
// indhold eller betydning — kun hvordan de grupperes. Fødselsdage og
// Deleøkonomi er familiedata, ikke kerne-kontoindstillinger, og hører
// derfor under "Familie" sammen med FamilySection.
//
// Reviewfund (efter opdelingen i faner): et link/en besked, der tidligere
// bare navigerede til "/settings", ville nu altid lande på standardfanen
// ("Familie") — brugeren skulle selv lede efter fx Kalenderforbindelser.
// Hver fane har derfor et stabilt id, valgbart via "?tab="-URL-parameteren
// (samme princip som CalendarPage's location.state.openNewEventDialog,
// men som en URL-parameter i stedet for router-state, så et link/bogmærke
// til en bestemt fane fortsat virker efter en genindlæsning eller når det
// deles/åbnes i en ny fane).
const settingsTabs = [
  {
    id: "family",
    label: "Familie",
    content: (
      <>
        <FamilySection />
        <BirthdaysSection />
        <SharedExpensesSection />
      </>
    ),
  },
  { id: "calendar-connections", label: "Kalenderforbindelser", content: <CalendarConnectionsSection /> },
  { id: "features", label: "Funktioner og notifikationer", content: <AppNotificationsSection /> },
  { id: "account", label: "Konto og data", content: <AccountDataSection /> },
  { id: "help", label: "Hjælp og feedback", content: <HelpFeedbackSection /> },
] as const;

function findTabIndex(tabId: string | null): number {
  if (!tabId) return 0;
  const index = settingsTabs.findIndex((tab) => tab.id === tabId);
  return index === -1 ? 0 : index;
}

function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Læses kun som starttilstand (lazy useState) — selve fanevisningen
  // styres derefter af activeTab, ikke direkte af URL'en ved hvert render,
  // så et tilbage-tryk i browseren ikke uventet hopper fanen tilbage,
  // mens brugeren stadig er på siden.
  const [activeTab, setActiveTab] = useState(() => findTabIndex(searchParams.get("tab")));

  function handleChangeTab(index: number) {
    setActiveTab(index);
    // replace: true — fane-skift er ikke egne navigationsskridt, en
    // bruger skal ikke skulle trykke "tilbage" flere gange for at forlade
    // Indstillinger, blot fordi de kiggede på et par faner undervejs.
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", settingsTabs[index].id);
      return next;
    }, { replace: true });
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Indstillinger</Typography>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Administrer familie, kalendere og appens indstillinger.
        </Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_event, value: number) => handleChangeTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 2.5, borderBottom: "1px solid", borderColor: "divider" }}
      >
        {settingsTabs.map((tab, index) => (
          <Tab key={tab.id} label={tab.label} id={`settings-tab-${index}`} aria-controls={`settings-tabpanel-${index}`} />
        ))}
      </Tabs>

      {settingsTabs.map((tab, index) => (
        <Box
          key={tab.id}
          role="tabpanel"
          id={`settings-tabpanel-${index}`}
          aria-labelledby={`settings-tab-${index}`}
          hidden={activeTab !== index}
        >
          {activeTab === index && <Box sx={{ display: "grid", gap: 2.5 }}>{tab.content}</Box>}
        </Box>
      ))}
    </Box>
  );
}

export default SettingsPage;
