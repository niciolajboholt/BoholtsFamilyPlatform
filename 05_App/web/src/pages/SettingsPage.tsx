import { Box, Typography } from "@mui/material";

import { AccountDataSection } from "../features/settings/components/AccountDataSection";
import { AppNotificationsSection } from "../features/settings/components/AppNotificationsSection";
import { CalendarConnectionsSection } from "../features/settings/components/CalendarConnectionsSection";
import { FamilySection } from "../features/settings/components/FamilySection";
import { HelpFeedbackSection } from "../features/settings/components/HelpFeedbackSection";
import { IcsSubscriptionsSection } from "../features/settings/components/IcsSubscriptionsSection";

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
        <FamilySection />
        <CalendarConnectionsSection />
        <IcsSubscriptionsSection />
        <AppNotificationsSection />
        <AccountDataSection />
        <HelpFeedbackSection />
      </Box>
    </Box>
  );
}

export default SettingsPage;
