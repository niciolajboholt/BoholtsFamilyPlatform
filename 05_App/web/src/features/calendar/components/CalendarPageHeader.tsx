import AddIcon from "@mui/icons-material/Add";
import { CloudDoneRounded } from "@mui/icons-material";
import { Box, Button, Tooltip, Typography } from "@mui/material";

interface CalendarPageHeaderProps {
  connectedProviderLabels: string[];
  onCreateEvent: () => void;
}

export function CalendarPageHeader({ connectedProviderLabels, onCreateEvent }: CalendarPageHeaderProps) {
  return (
    <Box
      sx={{
        mb: 3,
        display: "flex",
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
        flexDirection: { xs: "column", sm: "row" },
        gap: 2,
      }}
    >
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h4">Kalender</Typography>

          {connectedProviderLabels.length > 0 && (
            <Tooltip
              title={`${connectedProviderLabels.join(" og ")} Kalender: Synkroniseret`}
              enterTouchDelay={0}
            >
              <CloudDoneRounded
                color="success"
                fontSize="small"
                aria-label={`${connectedProviderLabels.join(" og ")} Kalender er synkroniseret`}
              />
            </Tooltip>
          )}
        </Box>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Familiens aftaler samlet ét sted.
        </Typography>
      </Box>

      <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateEvent}>
        Ny aftale
      </Button>
    </Box>
  );
}
