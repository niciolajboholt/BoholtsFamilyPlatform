import { useState } from "react";

import { RateReviewRounded } from "@mui/icons-material";
import { Avatar, Box, Button, Card, CardContent, Typography } from "@mui/material";

import { FeedbackDialog } from "../../feedback/FeedbackDialog";
import { FeedbackInboxCard } from "../../feedback/FeedbackInboxCard";
import { useDeploymentVersion } from "../../system/useDeploymentVersion";
import { SettingsSectionHeader } from "./SettingsPrimitives";

export function HelpFeedbackSection() {
  const deploymentVersion = useDeploymentVersion();
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

  return (
    <>
      <SettingsSectionHeader>Hjælp og feedback</SettingsSectionHeader>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ bgcolor: "secondary.main" }}>
              <RateReviewRounded />
            </Avatar>

            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>Send feedback</Typography>

              <Typography variant="body2" color="text.secondary">
                Idéer, fejl eller andet du vil dele
              </Typography>
            </Box>

            <Button variant="outlined" onClick={() => setIsFeedbackDialogOpen(true)}>
              Send
            </Button>
          </Box>
        </CardContent>
      </Card>

      <FeedbackInboxCard />

      {deploymentVersion && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", py: 1 }}>
          Version {deploymentVersion}
        </Typography>
      )}

      <FeedbackDialog open={isFeedbackDialogOpen} onClose={() => setIsFeedbackDialogOpen(false)} />
    </>
  );
}
