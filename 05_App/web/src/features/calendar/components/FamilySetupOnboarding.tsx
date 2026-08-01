import { useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  Box,
  Button,
  Container,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import { calendarOwners } from "../data/calendarOwners";
import type { CalendarOwner } from "../data/calendarOwners";
import { familyMemberColorSwatches as colorSwatches } from "../data/familyMemberColorSwatches";
import { familyMemberRelations } from "../data/familyMemberRelations";
import type { FamilyMemberRelation } from "../data/familyMemberRelations";
import { familyPseudoMemberId } from "../models/calendarEvent";
import { saveFamilyMembers } from "../preferences/familyMembersStorage";
import { slugifyMemberName } from "../hooks/useFamilyMembers";

const familyDefaultName = calendarOwners[familyPseudoMemberId].name;

interface MemberRow {
  key: string;
  originalName: string;
  name: string;
  relation: FamilyMemberRelation | "";
  color: string;
}

function seedRows(): MemberRow[] {
  return Object.values(calendarOwners)
    .filter((owner) => owner.id !== familyPseudoMemberId)
    .map((owner) => ({
      key: owner.id,
      originalName: owner.name,
      name: owner.name,
      relation: owner.relation ?? "",
      color: owner.color,
    }));
}

function nextUnusedColor(rows: MemberRow[]): string {
  const usedColors = new Set(rows.map((row) => row.color));
  return (
    colorSwatches.find((swatch) => !usedColors.has(swatch)) ?? colorSwatches[0]
  );
}

interface FamilySetupOnboardingProps {
  onDone: () => void;
}

export function FamilySetupOnboarding({ onDone }: FamilySetupOnboardingProps) {
  const [familyName, setFamilyName] = useState(familyDefaultName);
  const [rows, setRows] = useState<MemberRow[]>(() => seedRows());
  const [isTouched, setIsTouched] = useState(false);

  const trimmedFamilyName = familyName.trim();
  const familyNameError =
    isTouched && trimmedFamilyName.length === 0 ? "Skriv et navn." : null;

  function updateRow(key: string, patch: Partial<MemberRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: `new-${current.length}-${Date.now()}`,
        originalName: "",
        name: "",
        relation: "",
        color: nextUnusedColor(current),
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function buildMemberList(finalRows: MemberRow[], finalFamilyName: string) {
    const ids: string[] = [];
    const members: CalendarOwner[] = finalRows.map((row) => {
      const trimmedRowName = row.name.trim();
      const id = slugifyMemberName(trimmedRowName, ids);
      ids.push(id);

      return {
        id,
        name: trimmedRowName,
        color: row.color,
        relation: row.relation || undefined,
        isPlaceholderName: trimmedRowName === row.originalName,
      };
    });

    members.push({
      id: familyPseudoMemberId,
      name: finalFamilyName,
      color: calendarOwners[familyPseudoMemberId].color,
      isPlaceholderName: finalFamilyName === familyDefaultName,
    });

    return members;
  }

  function handleGetStarted() {
    const hasEmptyRowName = rows.some((row) => row.name.trim().length === 0);

    if (hasEmptyRowName || trimmedFamilyName.length === 0) {
      setIsTouched(true);
      return;
    }

    saveFamilyMembers(buildMemberList(rows, trimmedFamilyName));
    onDone();
  }

  function handleSkip() {
    saveFamilyMembers(Object.values(calendarOwners));
    onDone();
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Paper sx={{ p: 3, display: "grid", gap: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Velkommen!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Navngiv jeres familie og familiemedlemmer. I kan altid ændre det
              igen senere under Indstillinger.
            </Typography>
          </Box>

          <TextField
            label="Familiens navn"
            value={familyName}
            fullWidth
            error={Boolean(familyNameError)}
            helperText={familyNameError}
            onChange={(event) => setFamilyName(event.target.value)}
            onBlur={() => setIsTouched(true)}
          />

          <Box sx={{ display: "grid", gap: 2 }}>
            {rows.map((row) => {
              const rowNameError =
                isTouched && row.name.trim().length === 0
                  ? "Skriv et navn."
                  : null;

              return (
                <Box
                  key={row.key}
                  sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                >
                  <Box
                    component="button"
                    type="button"
                    aria-label={`Vælg farven ${row.color}`}
                    onClick={() =>
                      updateRow(row.key, {
                        color:
                          colorSwatches[
                            (colorSwatches.indexOf(row.color) + 1) %
                              colorSwatches.length
                          ],
                      })
                    }
                    sx={{
                      width: 40,
                      height: 40,
                      mt: 0.5,
                      flexShrink: 0,
                      borderRadius: "50%",
                      backgroundColor: row.color,
                      cursor: "pointer",
                      border: "none",
                      outline: "1px solid",
                      outlineColor: "divider",
                      outlineOffset: -1,
                      p: 0,
                    }}
                  />

                  <TextField
                    label="Navn"
                    value={row.name}
                    fullWidth
                    error={Boolean(rowNameError)}
                    helperText={rowNameError}
                    onChange={(event) =>
                      updateRow(row.key, { name: event.target.value })
                    }
                  />

                  <TextField
                    select
                    label="Relation"
                    value={row.relation}
                    sx={{ minWidth: 110 }}
                    onChange={(event) =>
                      updateRow(row.key, {
                        relation: event.target.value as FamilyMemberRelation,
                      })
                    }
                  >
                    {familyMemberRelations.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>

                  <IconButton
                    aria-label="Fjern familiemedlem"
                    onClick={() => removeRow(row.key)}
                    sx={{ mt: 0.5 }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Box>
              );
            })}

            <Button startIcon={<AddIcon />} onClick={addRow} sx={{ justifySelf: "start" }}>
              Tilføj familiemedlem
            </Button>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Button onClick={handleSkip}>Spring over</Button>
            <Button variant="contained" onClick={handleGetStarted}>
              Kom i gang
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
