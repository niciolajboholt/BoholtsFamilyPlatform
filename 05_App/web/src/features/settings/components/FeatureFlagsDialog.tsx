import {
  AutorenewRounded,
  CakeRounded,
  CheckCircleOutlineRounded,
  PaidRounded,
  RestaurantMenuRounded,
  SavingsRounded,
  ShoppingCartOutlined,
  TvRounded,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Switch,
  Typography,
} from "@mui/material";

import type { FeatureKey } from "../../family/familyApi";
import { useEnabledFeatures } from "../../family/hooks/useEnabledFeatures";

interface FeatureDefinition {
  key: FeatureKey;
  title: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}

// Rækkefølgen matcher, hvor tæt funktionen er på appens kerne (indkøb/
// opgaver/rutiner øverst) ned til de nyeste, mest valgfrie tilføjelser.
const features: FeatureDefinition[] = [
  {
    key: "shopping-list",
    title: "Indkøbsliste",
    description: "Fælles indkøbslister for familien, med kategorier og skabeloner.",
    color: "#2F8F82",
    icon: <ShoppingCartOutlined />,
  },
  {
    key: "tasks",
    title: "Opgaver",
    description: "Engangsopgaver for familien, med tildeling og påmindelser.",
    color: "#6B4FA0",
    icon: <CheckCircleOutlineRounded />,
  },
  {
    key: "routines",
    title: "Rutiner",
    description: "Faste, tilbagevendende opgaver — fx morgenrutiner på skoledage.",
    color: "#9C7A2E",
    icon: <AutorenewRounded />,
  },
  {
    key: "meal-plan",
    title: "Måltidsplanlægning",
    description: "Planlæg ugens retter og få et automatisk indkøbsforslag.",
    color: "#2F6B4F",
    icon: <RestaurantMenuRounded />,
  },
  {
    key: "task-rewards",
    title: "Opgave-belønning",
    description: "Sæt en kontant belønning på opgaver og hold styr på lommepenge.",
    color: "#B5722E",
    icon: <SavingsRounded />,
  },
  {
    key: "birthdays",
    title: "Fødselsdage og gaveideer",
    description: "Gem fødselsdage og saml gaveideer — skjult for den de er til.",
    color: "#C2477A",
    icon: <CakeRounded />,
  },
  {
    key: "shared-expenses",
    title: "Deleøkonomi mellem forældre",
    description: "Se hvem der har lagt ud for fælles udgifter, og afregn.",
    color: "#3D6FB4",
    icon: <PaidRounded />,
  },
  {
    key: "kiosk",
    title: "Kiosk-dashboard",
    description: "En skrivebeskyttet oversigt til en fast skærm i køkkenet.",
    color: "#5E6B78",
    icon: <TvRounded />,
  },
];

interface FeatureFlagsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function FeatureFlagsDialog({ open, onClose }: FeatureFlagsDialogProps) {
  const { isEnabled, canManage, toggle } = useEnabledFeatures();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Flere funktioner</DialogTitle>

      <DialogContent sx={{ px: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, mb: 1 }}>
          {canManage
            ? "Kun ejer og admin kan ændre disse. Alle familiens medlemmer ser det, der er slået til."
            : "Kun ejer eller admin kan ændre disse."}
        </Typography>

        {features.map((feature, index) => (
          <Box key={feature.key}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.75, px: 2, py: 1.25 }}>
              <Avatar sx={{ bgcolor: feature.color, width: 40, height: 40 }}>{feature.icon}</Avatar>

              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>{feature.title}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.4 }}>
                  {feature.description}
                </Typography>
              </Box>

              <Switch
                checked={isEnabled(feature.key)}
                disabled={!canManage}
                onChange={(event) => toggle(feature.key, event.target.checked)}
                slotProps={{ input: { "aria-label": `Slå ${feature.title} til eller fra` } }}
              />
            </Box>
            {index < features.length - 1 && <Divider />}
          </Box>
        ))}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
