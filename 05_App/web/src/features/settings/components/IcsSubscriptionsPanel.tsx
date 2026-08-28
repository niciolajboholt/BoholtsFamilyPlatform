import { useEffect, useState } from "react";

import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
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

import { familyMemberColorSwatches as colorSwatches } from "../../calendar/data/familyMemberColorSwatches";
import { clearCachedIcsEvents } from "../../calendar/preferences/icsCalendarSyncCacheStorage";
import { getInitials } from "../../calendar/utils/getInitials";
import {
  createIcsSubscription,
  deleteIcsSubscription,
  getIcsSubscriptions,
  getMyFamily,
  updateIcsSubscription,
  type FamilyMemberDto,
  type IcsCalendarSubscriptionDto,
} from "../../family/familyApi";

const maxSubscriptions = 5;

// Genbruger FamilyMemberDialog.tsx's swatch-mønster (samme faste 8-farve-
// palet, samme cirkel-som-knap-opbygning) — abonnementets farve bruges kun,
// når det IKKE er tildelt et familiemedlem; et tildelt medlems egen farve
// vinder altid (se icsCalendarMapper.ts), så vælgeren skjules mens et
// medlem er valgt for ikke at love en effekt, den ikke har.
function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Farve
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {colorSwatches.map((swatch) => (
          <Box
            key={swatch}
            component="button"
            type="button"
            aria-label={`Vælg farven ${swatch}`}
            aria-pressed={value === swatch}
            onClick={() => onChange(swatch)}
            sx={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: swatch,
              cursor: "pointer",
              border: "3px solid",
              borderColor: value === swatch ? "text.primary" : "transparent",
              outline: "1px solid",
              outlineColor: "divider",
              outlineOffset: -1,
              p: 0,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

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
  // Styret af IcsSubscriptionsDialog's egen open-tilstand — panelet henter
  // (gen)sin liste, hver gang dialogen åbnes, samme mønster som
  // useCalendarEvents.ts.
  isOpen: boolean;
}

// Fase 9: delte kalendere tilføjet via et ICS-link (Googles "hemmelige
// iCal-adresse", Outlooks offentlige kalenderlink, en skole-/
// idrætskalender osv.) — skrivebeskyttet. Selve indholdet af
// IcsSubscriptionsDialog, som åbnes fra sin egen række i
// "Kalenderforbindelser"-dialogen, samme niveau som Google/Outlook.
export function IcsSubscriptionsPanel({ isOpen }: IcsSubscriptionsPanelProps) {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const [subscriptions, setSubscriptions] = useState<IcsCalendarSubscriptionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [memberId, setMemberId] = useState("");
  const [color, setColor] = useState(colorSwatches[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redigering af et eksisterende abonnements navn/medlemstildeling/farve —
  // ikke selve ICS-linket, jf. Nicolajs ønske. Adskilt fra "Tilføj ny"-
  // formularens felter ovenfor, så et igangværende redigering ikke rammes
  // af den formulars egen reset efter et vellykket opret.
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editMemberId, setEditMemberId] = useState("");
  const [editColor, setEditColor] = useState(colorSwatches[0]);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);

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

  function rowColor(subscription: IcsCalendarSubscriptionDto): string | undefined {
    const assignedMember = subscription.familyMemberId
      ? members.find((member) => member.id === subscription.familyMemberId)
      : undefined;
    return assignedMember?.color ?? subscription.color ?? undefined;
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
      color: memberId ? null : color,
    });
    setIsSaving(false);

    if (result.ok && result.data.subscriptions) {
      setSubscriptions(result.data.subscriptions);
      setUrl("");
      setLabel("");
      setMemberId("");
      setColor(colorSwatches[0]);
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

  function startEditing(subscription: IcsCalendarSubscriptionDto) {
    setEditingSubscriptionId(subscription.id);
    setEditLabel(subscription.label);
    setEditMemberId(subscription.familyMemberId ?? "");
    setEditColor(subscription.color ?? colorSwatches[0]);
    setEditErrorMessage(null);
  }

  function cancelEditing() {
    setEditingSubscriptionId(null);
    setEditErrorMessage(null);
  }

  async function handleSaveEdit() {
    if (!familyId || !editingSubscriptionId || !editLabel.trim()) {
      return;
    }

    setIsEditSaving(true);
    setEditErrorMessage(null);
    const result = await updateIcsSubscription(familyId, editingSubscriptionId, {
      label: editLabel.trim(),
      familyMemberId: editMemberId || null,
      color: editMemberId ? null : editColor,
    });
    setIsEditSaving(false);

    if (result.ok && result.data.subscriptions) {
      setSubscriptions(result.data.subscriptions);
      setEditingSubscriptionId(null);
    } else {
      setEditErrorMessage(result.data.error ?? "Kunne ikke gemme ændringen.");
    }
  }

  const atCap = subscriptions.length >= maxSubscriptions;

  return (
    <Box>
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
                    {editingSubscriptionId === subscription.id ? (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1.5 }}>
                        <TextField
                          label="Navn"
                          value={editLabel}
                          onChange={(event) => setEditLabel(event.target.value)}
                          fullWidth
                          size="small"
                        />

                        <TextField
                          select
                          label="Tildel familiemedlem (valgfrit)"
                          value={editMemberId}
                          onChange={(event) => setEditMemberId(event.target.value)}
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

                        {!editMemberId && (
                          <ColorSwatchPicker value={editColor} onChange={setEditColor} />
                        )}

                        {editErrorMessage && <Alert severity="error">{editErrorMessage}</Alert>}

                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            variant="contained"
                            onClick={() => void handleSaveEdit()}
                            disabled={isEditSaving || !editLabel.trim()}
                            startIcon={isEditSaving ? <CircularProgress size={16} /> : undefined}
                          >
                            Gem
                          </Button>
                          <Button onClick={cancelEditing} disabled={isEditSaving}>
                            Annuller
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ display: "flex", alignItems: "center", py: 1 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: 14,
                            fontWeight: 700,
                            bgcolor: rowColor(subscription) ?? "secondary.main",
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
                          aria-label={`Redigér ${subscription.label}`}
                          onClick={() => startEditing(subscription)}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>

                        <IconButton
                          aria-label={`Fjern ${subscription.label}`}
                          onClick={() => void handleDelete(subscription.id)}
                        >
                          <DeleteOutlineRounded fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                    {index < subscriptions.length - 1 && <Divider />}
                  </Box>
                ))}
              </Box>
              <Divider sx={{ mb: 1.5 }} />
            </>
          )}

          {editingSubscriptionId ? null : atCap ? (
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

              {!memberId && <ColorSwatchPicker value={color} onChange={setColor} />}

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
