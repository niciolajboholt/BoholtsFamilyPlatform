import { useEffect, useState } from "react";

import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import { Alert, Avatar, Box, Button, Card, CardContent, CircularProgress, IconButton, Typography } from "@mui/material";

import { getMyFamily, getWeeklySummary, refreshWeeklySummary, type WeeklySummaryDto } from "./familyApi";

function formatWeekStart(weekStart: string): string {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long" }).format(
    new Date(`${weekStart}T00:00:00`),
  );
}

// Sprint 28: viser det nyeste AI-genererede ugeresumé, hvis et findes —
// genereres normalt ugentligt af server/lib/weeklySummary.ts's Cron
// Trigger, søndag aften for ugen der starter dagen efter. Ejer/admin kan
// derudover selv udløse et frisk resumé af DEN UGE, MAN ER I NU via
// opdater-knappen (POST .../weekly-summary/refresh) — nyttigt både hvis man
// ikke vil vente til søndag, og hvis ugens indhold har ændret sig undervejs.
// Et almindeligt medlem uden den rolle ser kortet slet ikke, før cron'en har
// lavet det første resumé (samme "bundet til rigtige data"-princip som
// resten af forsiden) — der er intet for dem at trykke på alligevel.
export function WeeklySummaryCard() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [canRefresh, setCanRefresh] = useState(false);
  const [summary, setSummary] = useState<WeeklySummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then(async (familyResult) => {
      if (
        isCancelled ||
        !familyResult.ok ||
        !familyResult.data.family ||
        familyResult.data.family.aiWeeklySummaryEnabled === 0
      ) {
        setIsLoading(false);
        return;
      }

      setFamilyId(familyResult.data.family.id);
      setCanRefresh(familyResult.data.role === "owner" || familyResult.data.role === "admin");

      const result = await getWeeklySummary(familyResult.data.family.id);

      if (!isCancelled) {
        if (result.ok) {
          setSummary(result.data.summary ?? null);
        }
        setIsLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleRefresh(): Promise<void> {
    if (!familyId) return;

    setIsRefreshing(true);
    setRefreshError(null);

    const result = await refreshWeeklySummary(familyId);

    if (result.ok && result.data.summary) {
      setSummary(result.data.summary);
    } else {
      setRefreshError(result.data.error ?? "Kunne ikke opdatere resuméet.");
    }

    setIsRefreshing(false);
  }

  if (isLoading || (!summary && !canRefresh)) {
    return null;
  }

  return (
    <Card sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Avatar sx={{ bgcolor: "secondary.main" }}>
            <AutoAwesomeOutlined />
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6">Ugens resumé</Typography>
            <Typography variant="body2" color="text.secondary">
              {summary
                ? `Ugen fra ${formatWeekStart(summary.weekStart)} · AI-genereret, kan indeholde fejl`
                : "Intet resumé endnu"}
            </Typography>
          </Box>

          {canRefresh && summary && (
            <IconButton
              aria-label="Opdater ugens resumé"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
            >
              {isRefreshing ? <CircularProgress size={20} /> : <RefreshRounded />}
            </IconButton>
          )}
        </Box>

        {refreshError && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {refreshError}
          </Alert>
        )}

        {summary ? (
          // Sektionerne (server/lib/aiAssistant.ts) sikrer navn + linjeskift
          // deterministisk her i UI'et — fremhævningen af navnet afhænger
          // ikke af, at AI-modellen selv formaterer teksten korrekt.
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {summary.sections.map((section, index) => (
              <Typography key={`${section.name}-${index}`}>
                {section.name && (
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {section.name}:{" "}
                  </Box>
                )}
                {section.text}
              </Typography>
            ))}
          </Box>
        ) : (
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshRounded />}
          >
            Generér ugens resumé nu
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
