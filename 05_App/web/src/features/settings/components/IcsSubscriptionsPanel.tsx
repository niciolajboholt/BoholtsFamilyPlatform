import { useEffect, useState } from "react";

import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import { clearCachedIcsEvents } from "../../calendar/preferences/icsCalendarSyncCacheStorage";
import { getInitials } from "../../calendar/utils/getInitials";
import {
  createIcsSubscription,
  deleteIcsSubscription,
  getIcsSubscriptions,
  getMyFamily,
  type FamilyMemberDto,
  type IcsCalendarSubscriptionDto,
} from "../../family/familyApi";

const maxSubscriptions = 5;

function fetchStatusText(subscription: IcsCalendarSubscriptionDto): string | null {
  if (!subscription.lastFetchedAt) {
    return null;
  }

  const formatted = new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(subscription.lastFetchedAt));

  return subscription.lastFetchStatus === "ok"
    ? `Sidst hentet ${formatted}`
    : `Kunne ikke hentes ${formatted}`;
}

interface IcsSubscriptionsPanelProps {
  // Genbruger CalendarConnectionsSection's dialogtilstand — panelet henter
  // (gen)sin liste, hver gang den fælles "Kalenderforbindelser"-dialog åbnes,
  // samme mønster som dialogen selv tidligere brugte for sit eget indhold.
  isOpen: boolean;
}

// Fase 9: delte kalendere tilføjet via et ICS-link (Googles "hemmelige
// iCal-adresse", Outlooks offentlige kalenderlink, en skole-/
// idrætskalender osv.) — skrivebeskyttet. Vises som en sektion i den
// eksisterende "Kalenderforbindelser"-dialog (samme sted som Google/Outlook),
// i stedet for sin egen selvstændige dialog, efter ønske fra Nicolaj.
export function IcsSubscriptionsPanel({ isOpen }: IcsSubscriptionsPanelProps) {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const [subscriptions, setSubscriptions] = useState<IcsCalendarSubscriptionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [memberId, setMemberId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;
    // Effekten genkører hver gang den fælles dialog genåbnes (ikke kun ved
    // mount) — uden dette ville et andet besøg i dialogen vise de forrige
    // data et øjeblik, før den friske hentning er færdig. Samme accepterede
    // undtagelse som useCalendarEvents.ts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    getMyFamily().then(async (result) => {
      if (isCancelled || !result.ok || !result.data.family) {
        setIsLoading(false);
        return;
      }

      const id = result.data.family.id;
      setFamilyId(id);
      setMembers(result.data.members ?? []);

      const listResult = await getIcsSubscriptions(id);
      if (!isCancelled && listResult.ok) {
        setSubscriptions(listResult.data.subscriptions ?? []);
      }

      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  function memberName(id: string | null): string | null {
    if (!id) return null;
    return members.find((member) => member.id === id)?.name ?? null;
  }

  async function handleAdd() {
    if (!familyId || !url.trim() || !label.trim()) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    const result = await createIcsSubscription(familyId, {
      url: url.trim(),
      label: label.trim(),
      familyMemberId: memberId || null,
    });
    setIsSaving(false);

    if (result.ok && result.data.subscriptions) {
      setSubscriptions(result.data.subscriptions);
      setUrl("");
      setLabel("");
      setMemberId("");
    } else {
      setErrorMessage(result.data.error ?? "Kunne ikke tilføje kalenderen.");
    }
  }

  async function handleDelete(subscriptionId: string) {
    if (!familyId) return;

    const result = await deleteIcsSubscription(familyId, subscriptionId);
    if (result.ok && result.data.subscriptions) {
      setSubscriptions(result.data.subscriptions);
      clearCachedIcsEvents(subscriptionId);
    }
  }

  const atCap = subscriptions.length >= maxSubscriptions;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Divider sx={{ mb: 1.5 }} />

      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Delte kalendere (ICS)</Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
            Tilføj en delt kalender via dens ICS-link — skrivebeskyttet, ingen
            login nødvendig til den konto.
          </Typography>

          {subscriptions.length > 0 && (
            <>
              <Box sx={{ display: "flex", flexDirection: "column", mb: 1.5 }}>
                {subscriptions.map((subscription, index) => (
                  <Box key={subscription.id}>
                    <Box sx={{ display: "flex", alignItems: "center", py: 1 }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: 14,
                          fontWeight: 700,
                          bgcolor: "secondary.main",
                          mr: 1.5,
                        }}
                      >
                        {getInitials(subscription.label)}
                      </Avatar>

                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {subscription.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {memberName(subscription.familyMemberId) ?? "Ikke tildelt"}
                          {fetchStatusText(subscription) ? ` · ${fetchStatusText(subscription)}` : ""}
                        </Typography>
                      </Box>

                      <IconButton
                        aria-label={`Fjern ${subscription.label}`}
                        onClick={() => void handleDelete(subscription.id)}
                      >
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    </Box>
                    {index < subscriptions.length - 1 && <Divider />}
                  </Box>
                ))}
              </Box>
              <Divider sx={{ mb: 1.5 }} />
            </>
          )}

          {atCap ? (
            <Alert severity="info">
              Højst {maxSubscriptions} delte kalendere ad gangen. Fjern en for
              at tilføje en ny.
            </Alert>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Tilføj ny
              </Typography>

              <TextField
                label="Navn"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                fullWidth
                size="small"
              />

              <TextField
                label="ICS-link"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
                fullWidth
                size="small"
              />

              <TextField
                select
                label="Tildel familiemedlem (valgfrit)"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="">Ikke tildelt</MenuItem>
                {members.map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.name}
                  </MenuItem>
                ))}
              </TextField>

              {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

              <Button
                variant="contained"
                onClick={() => void handleAdd()}
                disabled={isSaving || !url.trim() || !label.trim()}
                startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
              >
                Tilføj kalender
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
