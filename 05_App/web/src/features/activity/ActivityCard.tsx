import { useState } from "react";

import { ChevronRightRounded, HistoryRounded } from "@mui/icons-material";
import { Avatar, Box, Card, CardActionArea, Typography } from "@mui/material";

import { ActivityFullListDialog } from "./components/ActivityFullListDialog";
import { ActivitySummaryDialog } from "./components/ActivitySummaryDialog";
import { useActivitySummary } from "./useActivitySummary";

type DialogView = "closed" | "summary" | "full";

function formatRelativeSince(sinceIso: string): string {
  const diffDays = Math.floor((Date.now() - new Date(sinceIso).getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return "i dag";
  }

  return diffDays === 1 ? "1 dag siden" : `${diffDays} dage siden`;
}

// Sprint 33: kompakt teaser-kort på forsiden — selve indholdet ligger i
// dialogerne, der åbnes ved tryk (se planens beslutning 8). Vises kun når
// useActivitySummary rent faktisk har noget at vise (ærlig
// tom-tilstand, samme princip som WeeklySummaryCard).
export function ActivityCard() {
  const { isLoading, summary, acknowledge } = useActivitySummary();
  const [view, setView] = useState<DialogView>("closed");

  if (isLoading || !summary) {
    return null;
  }

  // Lukkes kortet — uanset om det sker direkte, eller efter "Vis alt" er
  // set færdig — kvitteres der med det samme, PRÆCISE asOf-tidspunkt
  // brugeren fik at se: kortet dukker ikke op igen før noget NYT er sket.
  function handleClose(): void {
    acknowledge();
    setView("closed");
  }

  const attentionCount = summary.calendar.moved.length + summary.calendar.cancelled.length;

  return (
    <>
      <Card sx={{ mb: 2.5 }}>
        <CardActionArea
          onClick={() => setView("summary")}
          sx={{ p: 3, display: "flex", alignItems: "center", gap: 1.5, borderRadius: 1 }}
        >
          <Avatar sx={{ bgcolor: "primary.main" }}>
            <HistoryRounded />
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6">Siden sidst du var her</Typography>

            <Typography variant="body2" color="text.secondary">
              {formatRelativeSince(summary.since)} · {summary.totalCount} ting
              {attentionCount > 0 ? `, ${attentionCount} kræver et blik` : ""}
            </Typography>
          </Box>

          <ChevronRightRounded color="action" />
        </CardActionArea>
      </Card>

      <ActivitySummaryDialog
        open={view === "summary"}
        summary={summary}
        onClose={handleClose}
        onShowAll={() => setView("full")}
      />

      <ActivityFullListDialog
        open={view === "full"}
        summary={summary}
        onBack={() => setView("summary")}
        onClose={handleClose}
      />
    </>
  );
}
