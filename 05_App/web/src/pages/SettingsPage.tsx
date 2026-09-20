import { useState } from "react";

import { Box, Tab, Tabs, Typography } from "@mui/material";

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
const settingsTabs = [
  { label: "Familie", content: (
    <>
      <FamilySection />
      <BirthdaysSection />
      <SharedExpensesSection />
    </>
  ) },
  { label: "Kalenderforbindelser", content: <CalendarConnectionsSection /> },
  { label: "Funktioner og notifikationer", content: <AppNotificationsSection /> },
  { label: "Konto og data", content: <AccountDataSection /> },
  { label: "Hjælp og feedback", content: <HelpFeedbackSection /> },
];

function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0);

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
        onChange={(_event, value: number) => setActiveTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 2.5, borderBottom: "1px solid", borderColor: "divider" }}
      >
        {settingsTabs.map((tab, index) => (
          <Tab key={tab.label} label={tab.label} id={`settings-tab-${index}`} aria-controls={`settings-tabpanel-${index}`} />
        ))}
      </Tabs>

      {settingsTabs.map((tab, index) => (
        <Box
          key={tab.label}
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
