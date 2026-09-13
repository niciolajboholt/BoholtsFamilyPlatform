import { useEffect, useState } from "react";

import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  Link,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import {
  clearExcludedIcloudCalendarsForConnection,
  getExcludedIcloudCalendarSourceIds,
  setExcludedIcloudCalendars,
} from "../../calendar/providers/apple/icloudCalendarExclusionStorage";
import { encodeIcloudCalendarSourceId } from "../../calendar/providers/apple/icloudCalendarIds";
import { getInitials } from "../../calendar/utils/getInitials";
import {
  createIcloudConnection,
  deleteIcloudConnection,
  getIcloudCalendars,
  getIcloudConnections,
  getMyFamily,
  type FamilyMemberDto,
  type IcloudCalendarInfoDto,
  type IcloudConnectionDto,
} from "../../family/familyApi";

const maxConnections = 5;

interface IcloudConnectionsPanelProps {
  // Samme mønster som IcsSubscriptionsPanel — panelet (gen)henter sin liste,
  // hver gang den fælles Kalenderforbindelser-dialog åbner den.
  isOpen: boolean;
}

// Sprint 47: iCloud-kalender via CalDAV. Åbnes fra sin egen række i
// "Kalenderforbindelser"-dialogen, samme niveau som Google/Outlook/ICS.
// I modsætning til ICS bekræftes loginoplysningerne mod iCloud, FØR
// forbindelsen overhovedet gemmes (se icloudConnections.ts) — en forkert
// app-specifik adgangskode viser derfor straks en fejl her, i stedet for
// først ved næste kalenderhentning.
export function IcloudConnectionsPanel({ isOpen }: IcloudConnectionsPanelProps) {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const [connections, setConnections] = useState<IcloudConnectionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [appleIdEmail, setAppleIdEmail] = useState("");
  const [appSpecificPassword, setAppSpecificPassword] = useState("");
  const [memberId, setMemberId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hvilke kalendere en forbindelse rent faktisk skal hente — en iCloud-konto
  // kan sagtens indeholde mange kalendere (Hjem, Fødselsdage, delte
  // familiekalendere, abonnerede helligdagskalendere osv.), og en fravalgt
  // kalender her hentes slet ikke af IcloudCalendarProvider (hverken dens
  // liste eller dens hændelser) — ikke kun skjult i visningen bagefter, se
  // icloudCalendarExclusionStorage.ts.
  const [excludedSourceIds, setExcludedSourceIdsState] = useState<string[]>(() =>
    getExcludedIcloudCalendarSourceIds(),
  );
  const [expandedConnectionId, setExpandedConnectionId] = useState<string | null>(null);
  const [calendarsByConnection, setCalendarsByConnection] = useState<
    Record<string, IcloudCalendarInfoDto[]>
  >({});
  const [loadingCalendarsForConnectionId, setLoadingCalendarsForConnectionId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;
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

      const listResult = await getIcloudConnections(id);
      if (!isCancelled && listResult.ok) {
        setConnections(listResult.data.connections ?? []);
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

  function rowColor(connection: IcloudConnectionDto): string | undefined {
    const assignedMember = connection.familyMemberId
      ? members.find((member) => member.id === connection.familyMemberId)
      : undefined;
    return assignedMember?.color;
  }

  async function handleAdd() {
    if (!familyId || !appleIdEmail.trim() || !appSpecificPassword.trim()) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    const result = await createIcloudConnection(familyId, {
      appleIdEmail: appleIdEmail.trim(),
      appSpecificPassword: appSpecificPassword.trim(),
      familyMemberId: memberId || null,
    });
    setIsSaving(false);

    if (result.ok && result.data.connections) {
      setConnections(result.data.connections);
      setAppleIdEmail("");
      setAppSpecificPassword("");
      setMemberId("");
    } else {
      setErrorMessage(result.data.error ?? "Kunne ikke forbinde til iCloud.");
    }
  }

  async function handleDelete(connectionId: string) {
    if (!familyId) return;

    const result = await deleteIcloudConnection(familyId, connectionId);
    if (result.ok && result.data.connections) {
      setConnections(result.data.connections);
      clearExcludedIcloudCalendarsForConnection(connectionId);
      setExcludedSourceIdsState(getExcludedIcloudCalendarSourceIds());
      setCalendarsByConnection((previous) => {
        const next = { ...previous };
        delete next[connectionId];
        return next;
      });
      if (expandedConnectionId === connectionId) {
        setExpandedConnectionId(null);
      }
    }
  }

  // Henter først forbindelsens kalenderliste, når brugeren rent faktisk
  // åbner "Vælg kalendere" — ikke ved siden af selve forbindelseslisten,
  // som ellers ville koste et ekstra PROPFIND-kald pr. forbindelse hver
  // gang dialogen åbnes, uanset om brugeren nogensinde vil justere valget.
  async function toggleCalendarPicker(connectionId: string) {
    if (expandedConnectionId === connectionId) {
      setExpandedConnectionId(null);
      return;
    }

    setExpandedConnectionId(connectionId);
    if (!familyId || calendarsByConnection[connectionId]) {
      return;
    }

    setLoadingCalendarsForConnectionId(connectionId);
    const result = await getIcloudCalendars(familyId, connectionId);
    if (result.ok) {
      setCalendarsByConnection((previous) => ({
        ...previous,
        [connectionId]: result.data.calendars ?? [],
      }));
    }
    setLoadingCalendarsForConnectionId(null);
  }

  function handleToggleCalendar(connectionId: string, calendarUrl: string) {
    const sourceId = encodeIcloudCalendarSourceId(connectionId, calendarUrl);
    const next = excludedSourceIds.includes(sourceId)
      ? excludedSourceIds.filter((id) => id !== sourceId)
      : [...excludedSourceIds, sourceId];

    setExcludedSourceIdsState(next);
    setExcludedIcloudCalendars(next);
  }

  const atCap = connections.length >= maxConnections;

  return (
    <Box>
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
            Hvert familiemedlem forbinder sin egen iCloud-konto med en{" "}
            <Link
              href="https://appleid.apple.com/account/manage"
              target="_blank"
              rel="noopener noreferrer"
            >
              app-specifik adgangskode
            </Link>{" "}
            — ikke Apple-ID'ets almindelige adgangskode.
          </Typography>

          {connections.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Tryk på kalender-ikonet for at vælge, hvilke af kontoens
                kalendere der skal hentes.
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", mb: 1.5 }}>
                {connections.map((connection, index) => (
                  <Box key={connection.id}>
                    <Box sx={{ display: "flex", alignItems: "center", py: 1 }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: 14,
                          fontWeight: 700,
                          bgcolor: rowColor(connection) ?? "secondary.main",
                          mr: 1.5,
                        }}
                      >
                        {getInitials(memberName(connection.familyMemberId) ?? connection.appleIdEmail)}
                      </Avatar>

                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {connection.appleIdEmail}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {memberName(connection.familyMemberId) ?? "Ikke tildelt"}
                        </Typography>
                      </Box>

                      <IconButton
                        aria-label={`Vælg kalendere for ${connection.appleIdEmail}`}
                        onClick={() => void toggleCalendarPicker(connection.id)}
                      >
                        <CalendarMonthOutlined fontSize="small" />
                      </IconButton>

                      <IconButton
                        aria-label={`Fjern ${connection.appleIdEmail}`}
                        onClick={() => void handleDelete(connection.id)}
                      >
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    </Box>

                    {expandedConnectionId === connection.id && (
                      <Box sx={{ pl: 1, pb: 1.5 }}>
                        {loadingCalendarsForConnectionId === connection.id ? (
                          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                            <CircularProgress size={18} />
                          </Box>
                        ) : (
                          <FormGroup>
                            {(calendarsByConnection[connection.id] ?? []).map((calendar) => {
                              const sourceId = encodeIcloudCalendarSourceId(connection.id, calendar.url);
                              return (
                                <FormControlLabel
                                  key={sourceId}
                                  sx={{ ml: 0 }}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={!excludedSourceIds.includes(sourceId)}
                                      onChange={() => handleToggleCalendar(connection.id, calendar.url)}
                                    />
                                  }
                                  label={
                                    <Typography variant="body2">{calendar.displayName}</Typography>
                                  }
                                />
                              );
                            })}
                            {(calendarsByConnection[connection.id] ?? []).length === 0 && (
                              <Typography variant="body2" color="text.secondary">
                                Ingen kalendere fundet på denne konto.
                              </Typography>
                            )}
                          </FormGroup>
                        )}
                      </Box>
                    )}
                    {index < connections.length - 1 && <Divider />}
                  </Box>
                ))}
              </Box>
              <Divider sx={{ mb: 1.5 }} />
            </>
          )}

          {atCap ? (
            <Alert severity="info">
              Højst {maxConnections} iCloud-forbindelser ad gangen. Fjern en for
              at tilføje en ny.
            </Alert>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Tilføj ny
              </Typography>

              <TextField
                label="Apple-ID (e-mail)"
                type="email"
                value={appleIdEmail}
                onChange={(event) => setAppleIdEmail(event.target.value)}
                fullWidth
                size="small"
              />

              <TextField
                label="App-specifik adgangskode"
                type="password"
                value={appSpecificPassword}
                onChange={(event) => setAppSpecificPassword(event.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                fullWidth
                size="small"
              />

              <TextField
                select
                label="Tildel familiemedlem"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
                fullWidth
                size="small"
                helperText="Denne konto er som udgangspunkt medlemmets egen kalender."
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
                disabled={isSaving || !appleIdEmail.trim() || !appSpecificPassword.trim()}
                startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
              >
                Forbind iCloud-kalender
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
