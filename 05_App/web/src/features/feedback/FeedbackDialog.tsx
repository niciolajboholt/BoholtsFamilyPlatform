import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import type { FeedbackCategory } from "./feedbackApi";
import { submitFeedback } from "./feedbackApi";

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

const categoryOptions: { value: FeedbackCategory; label: string }[] = [
  { value: "idea", label: "Idé" },
  { value: "bug", label: "Fejl" },
  { value: "other", label: "Andet" },
];

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    onClose();

    // Ryddes efter dialogens luk-animation, så feltet ikke synligt
    // nulstiller sig, mens brugeren stadig ser dialogen lukke.
    setTimeout(() => {
      setCategory("idea");
      setMessage("");
      setError(null);
      setIsSubmitted(false);
    }, 200);
  }

  async function handleSubmit() {
    if (!message.trim()) {
      setError("Skriv en besked, før du sender.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await submitFeedback({
      category,
      message: message.trim(),
      page: window.location.pathname,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.data.error ?? "Feedback kunne ikke sendes. Prøv igen.");
      return;
    }

    setIsSubmitted(true);
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Send feedback</DialogTitle>

      <DialogContent>
        {isSubmitted ? (
          <Box sx={{ py: 2, textAlign: "center" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Tak for din feedback! 🙏
            </Typography>

            <Typography color="text.secondary">
              Den er sendt videre og bliver læst.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
            <Typography color="text.secondary">
              Har du en idé, fundet en fejl, eller vil du bare sige noget om
              appen? Skriv det herunder.
            </Typography>

            <ToggleButtonGroup
              value={category}
              exclusive
              size="small"
              onChange={(_event, value: FeedbackCategory | null) => {
                if (value) {
                  setCategory(value);
                }
              }}
              aria-label="Kategori"
            >
              {categoryOptions.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <TextField
              label="Besked"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              multiline
              minRows={4}
              autoFocus
              fullWidth
              disabled={isSubmitting}
            />

            {error && <Alert severity="error">{error}</Alert>}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          {isSubmitted ? "Luk" : "Annuller"}
        </Button>

        {!isSubmitted && (
          <Button
            variant="contained"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            startIcon={
              isSubmitting ? (
                <CircularProgress size={18} color="inherit" />
              ) : undefined
            }
          >
            {isSubmitting ? "Sender..." : "Send"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
