import { Box } from "@mui/material";

interface ConflictBadgeProps {
  isConflict: boolean;
}

// Sprint 26: samme lille badge-mønster som EventSourceBadge — supplerer
// ejer-farven i stedet for at overskrive den, så begge informationer (hvem
// ejer aftalen, og om den overlapper en anden) forbliver synlige samtidig.
function ConflictBadge({ isConflict }: ConflictBadgeProps) {
  if (!isConflict) {
    return null;
  }

  return (
    <Box
      aria-label="Overlapper en anden aftale"
      title="Overlapper en anden aftale"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 14,
        height: 14,
        borderRadius: "50%",
        backgroundColor: "warning.main",
        color: "#ffffff",
        fontSize: "0.6rem",
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      !
    </Box>
  );
}

export default ConflictBadge;
