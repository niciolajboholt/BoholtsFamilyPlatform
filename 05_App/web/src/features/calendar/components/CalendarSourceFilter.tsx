import { useMemo, useState } from "react";

import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  Tooltip,
  Typography,
} from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import type { CalendarEvent } from "../models/calendarEvent";
import type { CalendarProviderType, CalendarSource } from "../models/calendarProvider";
import type { CalendarProviderHealth } from "../models/calendarProviderHealth";
import { getCalendarSourceDisplayColors } from "../utils/getEventOwnerColor";

interface CalendarSourceFilterProps {
  calendarSources: CalendarSource[];
  visibleCalendarSourceIds: string[];
  events?: readonly CalendarEvent[];
  members?: readonly CalendarOwner[];
  providerHealth?: readonly CalendarProviderHealth[];
  isLoading: boolean;
  error: string | null;
  onToggle: (sourceId: string) => void;
  onShowAll: () => void;
  onRetry: () => void;
}

// Sprint 57: "Fælles og andet" samler kilder uden en entydig ejer (fx et
// delt ICS-abonnement, der ikke er koblet til ét bestemt medlem) — samme
// gruppe, uanset hvor mange sådanne kilder der findes.
const sharedGroupKey = "__shared__";

interface CalendarSourceGroup {
  key: string;
  label: string;
  color?: string;
  sources: CalendarSource[];
}

function buildGroups(
  sources: readonly CalendarSource[],
  members: readonly CalendarOwner[],
): CalendarSourceGroup[] {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const groups = new Map<string, CalendarSourceGroup>();

  for (const source of sources) {
    const member = source.ownerId ? memberById.get(source.ownerId) : undefined;
    const key = member ? member.id : sharedGroupKey;

    let group = groups.get(key);
    if (!group) {
      group = { key, label: member ? member.name : "Fælles og andet", color: member?.color, sources: [] };
      groups.set(key, group);
    }
    group.sources.push(source);
  }

  // Rækkefølge: familiemedlemmer i samme rækkefølge som members-listen
  // (matcher resten af appens medlemsvisning), "Fælles og andet" til sidst.
  const ordered: CalendarSourceGroup[] = [];
  for (const member of members) {
    const group = groups.get(member.id);
    if (group) {
      ordered.push(group);
    }
  }
  const shared = groups.get(sharedGroupKey);
  if (shared) {
    ordered.push(shared);
  }
  return ordered;
}

const providerLabels: Record<CalendarProviderType, string> = {
  google: "Google",
  outlook: "Outlook",
  apple: "iCloud",
  ics: "Abonnement",
};

// Mange grupper foldet sammen som standard ville gøre en lille families
// filter (typisk 2-4 kilder i alt) mere besværligt end den tidligere flade
// liste — kun familier med reelt mange kilder får glæde af sammenfoldning,
// så tærsklen matcher opgavens eget eksempel ("12 af 17 kalendere").
const collapseByDefaultThreshold = 6;

export function CalendarSourceFilter({
  calendarSources,
  visibleCalendarSourceIds,
  events = [],
  members = [],
  providerHealth = [],
  isLoading,
  error,
  onToggle,
  onShowAll,
  onRetry,
}: CalendarSourceFilterProps) {
  const groups = useMemo(() => buildGroups(calendarSources, members), [calendarSources, members]);
  const shouldCollapseByDefault = calendarSources.length > collapseByDefaultThreshold;

  // `null` betyder "brugeren har endnu ikke selv fold(et) noget ud/sammen"
  // — den effektive tilstand udledes så hver render direkte af
  // shouldCollapseByDefault, i stedet for at blive "frosset" ved mount
  // (hvor calendarSources typisk stadig er tom, mens kilderne indlæses,
  // og derfor ville låse "alle foldet ud" fast, selv efter mange kilder
  // senere er ankommet).
  const [manualCollapsedGroupKeys, setManualCollapsedGroupKeys] = useState<Set<string> | null>(null);
  const collapsedGroupKeys =
    manualCollapsedGroupKeys ?? (shouldCollapseByDefault ? new Set(groups.map((group) => group.key)) : new Set());

  if (isLoading && calendarSources.length === 0) {
    return (
      <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={18} />
        <Typography variant="body2">Indlæser kalendere…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Prøv igen
          </Button>
        }
      >
        Kalenderkilder kunne ikke indlæses.
      </Alert>
    );
  }

  const visibleCount = calendarSources.filter((source) => visibleCalendarSourceIds.includes(source.id)).length;
  const allGroupsCollapsed = groups.length > 0 && groups.every((group) => collapsedGroupKeys.has(group.key));

  function toggleGroup(key: string) {
    const next = new Set(collapsedGroupKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setManualCollapsedGroupKeys(next);
  }

  function toggleAllGroups() {
    setManualCollapsedGroupKeys(allGroupsCollapsed ? new Set() : new Set(groups.map((group) => group.key)));
  }

  function findProviderHealth(providerType: CalendarProviderType): CalendarProviderHealth | undefined {
    return providerHealth.find((health) => health.providerId === providerType);
  }

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Vis kalendere
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {visibleCount} af {calendarSources.length} kalendere vises
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {groups.length > 1 && (
            <Button size="small" onClick={toggleAllGroups}>
              {allGroupsCollapsed ? "Fold alle ud" : "Fold alle sammen"}
            </Button>
          )}
          <Button size="small" onClick={onShowAll}>
            Vis alle
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gap: 0.5 }}>
        {groups.map((group) => {
          const isExpanded = !collapsedGroupKeys.has(group.key);
          const groupVisibleCount = group.sources.filter((source) =>
            visibleCalendarSourceIds.includes(source.id),
          ).length;

          return (
            <Accordion
              key={group.key}
              disableGutters
              expanded={isExpanded}
              onChange={() => toggleGroup(group.key)}
              sx={{ "&:before": { display: "none" }, boxShadow: "none", border: "1px solid", borderColor: "divider" }}
            >
              <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                  {group.color && (
                    <Box
                      aria-hidden="true"
                      sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: group.color, flexShrink: 0 }}
                    />
                  )}
                  <Typography sx={{ fontWeight: 600 }}>{group.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    ({groupVisibleCount} af {group.sources.length})
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <FormGroup sx={{ gap: 0.5 }}>
                  {group.sources.map((source) => {
                    const checked = visibleCalendarSourceIds.includes(source.id);
                    const displayColors = getCalendarSourceDisplayColors(source.id, source.color, events, members);
                    const primaryColor = displayColors[0];
                    const health = findProviderHealth(source.providerType);
                    const hasWarning = health?.status === "error" || health?.status === "disconnected";

                    return (
                      <FormControlLabel
                        key={source.id}
                        sx={{ mr: 1, alignItems: "flex-start" }}
                        control={
                          <Checkbox
                            checked={checked}
                            onChange={() => onToggle(source.id)}
                            sx={{
                              color: primaryColor,
                              "&.Mui-checked": { color: primaryColor },
                              mt: -0.5,
                            }}
                          />
                        }
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                            <Box>
                              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                                <Typography component="span">{source.name}</Typography>
                                <Box
                                  component="span"
                                  aria-hidden="true"
                                  sx={{ display: "inline-flex", gap: 0.35 }}
                                >
                                  {displayColors.slice(0, 4).map((color) => (
                                    <Box
                                      component="span"
                                      key={color}
                                      sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        backgroundColor: color,
                                        flexShrink: 0,
                                      }}
                                    />
                                  ))}
                                </Box>
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                {providerLabels[source.providerType]}
                              </Typography>
                            </Box>
                            {hasWarning && (
                              <Tooltip
                                title={
                                  health?.message ??
                                  "Kilden kunne ikke opdateres lige nu. Prøv at forbinde den igen under Indstillinger."
                                }
                              >
                                <WarningAmberRounded
                                  color="warning"
                                  fontSize="small"
                                  aria-label={`Advarsel for ${source.name}: ${health?.message ?? "kilden kunne ikke opdateres"}`}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        }
                      />
                    );
                  })}
                </FormGroup>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </>
  );
}
