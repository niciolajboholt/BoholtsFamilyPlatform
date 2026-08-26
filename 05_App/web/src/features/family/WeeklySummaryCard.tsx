import { useEffect, useState } from "react";

import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import { Avatar, Box, Card, CardContent, Typography } from "@mui/material";

import { getMyFamily, getWeeklySummary, type WeeklySummaryDto } from "./familyApi";

function formatWeekStart(weekStart: string): string {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long" }).format(
    new Date(`${weekStart}T00:00:00`),
  );
}

// Sprint 28: viser det nyeste AI-genererede ugeresumé, hvis et findes —
// genereres ugentligt af server/lib/weeklySummary.ts's Cron Trigger, ikke
// on-demand herfra. Vises slet ikke, før det første er genereret (samme
// "bundet til rigtige data"-princip som resten af forsiden), i stedet for
// en permanent tom-tilstand indtil første søndag.
export function WeeklySummaryCard() {
  const [summary, setSummary] = useState<WeeklySummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading || !summary) {
    return null;
  }

  return (
    <Card sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Avatar sx={{ bgcolor: "secondary.main" }}>
            <AutoAwesomeOutlined />
          </Avatar>

          <Box>
            <Typography variant="h6">Ugens resumé</Typography>
            <Typography variant="body2" color="text.secondary">
              Ugen fra {formatWeekStart(summary.weekStart)} · AI-genereret, kan indeholde fejl
            </Typography>
          </Box>
        </Box>

        <Typography>{summary.content}</Typography>
      </CardContent>
    </Card>
  );
}
