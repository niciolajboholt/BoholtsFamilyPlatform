import { useEffect, useState } from "react";

import { MarkEmailReadRounded, MarkEmailUnreadRounded } from "@mui/icons-material";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Typography,
} from "@mui/material";

import type { FeedbackCategory, FeedbackEntryDto } from "./feedbackApi";
import { getFeedback, markFeedbackRead } from "./feedbackApi";

const categoryLabels: Record<FeedbackCategory, string> = {
  idea: "Idé",
  bug: "Fejl",
  other: "Andet",
};

function formatSubmittedAt(value: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// Kun synlig for ADMIN_EMAIL (server-side håndhævet i /api/feedback) — et
// 403-svar her betyder blot "vis ikke kortet", ikke en fejl der skal
// meldes til brugeren.
export function FeedbackInboxCard() {
  const [entries, setEntries] = useState<FeedbackEntryDto[] | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    getFeedback().then((result) => {
      if (isCancelled) {
        return;
      }

      if (result.ok && result.data.feedback) {
        setEntries(result.data.feedback);
        setIsVisible(true);
      }

      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleToggleRead(entry: FeedbackEntryDto) {
    const nextIsRead = entry.isRead === 0;

    setEntries(
      (current) =>
        current?.map((candidate) =>
          candidate.id === entry.id
            ? { ...candidate, isRead: nextIsRead ? 1 : 0 }
            : candidate,
        ) ?? null,
    );

    await markFeedbackRead(entry.id, nextIsRead);
  }

  if (!isVisible || isLoading) {
    return null;
  }

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Modtaget feedback
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Kun synlig for dig som ejer af appen.
        </Typography>

        {!entries || entries.length === 0 ? (
          <Typography color="text.secondary">
            Ingen feedback endnu.
          </Typography>
        ) : (
          entries.map((entry, index) => (
            <Box key={entry.id}>
              {index > 0 && <Divider sx={{ my: 1.5 }} />}

              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.5,
                  opacity: entry.isRead ? 0.6 : 1,
                }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 0.5,
                      flexWrap: "wrap",
                    }}
                  >
                    <Chip
                      label={categoryLabels[entry.category]}
                      size="small"
                    />

                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {entry.senderName}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      {formatSubmittedAt(entry.createdAt)}
                      {entry.page ? ` · ${entry.page}` : ""}
                    </Typography>
                  </Box>

                  <Typography sx={{ whiteSpace: "pre-wrap" }}>
                    {entry.message}
                  </Typography>
                </Box>

                <IconButton
                  aria-label={
                    entry.isRead ? "Markér som ulæst" : "Markér som læst"
                  }
                  onClick={() => void handleToggleRead(entry)}
                  size="small"
                >
                  {entry.isRead ? (
                    <MarkEmailReadRounded fontSize="small" />
                  ) : (
                    <MarkEmailUnreadRounded fontSize="small" color="primary" />
                  )}
                </IconButton>
              </Box>
            </Box>
          ))
        )}
      </CardContent>
    </Card>
  );
}
