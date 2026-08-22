import { WarningAmberRounded } from "@mui/icons-material";
import { Tooltip } from "@mui/material";

interface ConflictBadgeProps {
  isConflict: boolean;
}

// Sprint 26: samme lille badge-mønster som EventSourceBadge — supplerer
// ejer-farven i stedet for at overskrive den, så begge informationer (hvem
// ejer aftalen, og om den overlapper en anden) forbliver synlige samtidig.
//
// Et rigtigt advarselsikon + en MUI-tooltip i stedet for en bar "!" i en
// cirkel med kun en native title-tooltip — nemmere at genkende og
// tilgængelig (fungerer også ved tryk på mobil, jf. enterTouchDelay).
function ConflictBadge({ isConflict }: ConflictBadgeProps) {
  if (!isConflict) {
    return null;
  }

  return (
    <Tooltip title="Overlapper en anden aftale" enterTouchDelay={0}>
      <WarningAmberRounded
        aria-label="Overlapper en anden aftale"
        sx={{
          fontSize: 16,
          color: "warning.main",
          flexShrink: 0,
        }}
      />
    </Tooltip>
  );
}

export default ConflictBadge;
