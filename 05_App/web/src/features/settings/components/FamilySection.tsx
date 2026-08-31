import { useEffect, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import {
  CalendarMonthRounded,
  ChevronRightRounded,
  FamilyRestroomRounded,
  GroupAddRounded,
  LinkRounded,
  ManageAccountsRounded,
} from "@mui/icons-material";
import { Avatar, Box, Button, Card, CardContent, Divider, IconButton, Typography } from "@mui/material";

import { FamilyMemberDialog } from "../../calendar/components/FamilyMemberDialog";
import type { CalendarOwner } from "../../calendar/data/calendarOwners";
import { useFamilyMembers } from "../../calendar/hooks/useFamilyMembers";
import {
  getCalendarIdForOwner,
  refreshCalendarMemberMappingsFromServer,
} from "../../calendar/preferences/calendarMemberMappingStorage";
import type { MappableCalendarOption } from "../../calendar/providers/calendarProviderFactory";
import { listAllMappableCalendars } from "../../calendar/providers/calendarProviderFactory";
import { getInitials } from "../../calendar/utils/getInitials";
import { FamilyMembershipsDialog } from "../../family/FamilyMembershipsDialog";
import { InviteCodeDialog } from "../../family/InviteCodeDialog";
import { ShareLinkDialog } from "../../family/ShareLinkDialog";
import { SettingsLinkRow, SettingsSectionHeader } from "./SettingsPrimitives";

export function FamilySection() {
  const { members, addMember, updateMember, deleteMember } = useFamilyMembers();

  const [editingMember, setEditingMember] = useState<CalendarOwner | null>(null);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isMembershipsDialogOpen, setIsMembershipsDialogOpen] = useState(false);

  // Kalender-til-medlem-visning (kun læsning her — selve tildelingen sker i
  // FamilyMemberDialog) — hentes én gang, så familielisten kan vise hvilken
  // kalender hvert medlem allerede er koblet til.
  const [calendarOptions, setCalendarOptions] = useState<MappableCalendarOption[]>([]);

  useEffect(() => {
    let isCancelled = false;

    Promise.all([listAllMappableCalendars(), refreshCalendarMemberMappingsFromServer()])
      .then(([options]) => {
        if (!isCancelled) {
          setCalendarOptions(options);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCalendarOptions([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const calendarLabelByRawId = new Map(
    calendarOptions.map((option) => [option.rawCalendarId, option.label]),
  );

  function handleOpenAddMember() {
    setEditingMember(null);
    setIsMemberDialogOpen(true);
  }

  function handleOpenEditMember(member: CalendarOwner) {
    setEditingMember(member);
    setIsMemberDialogOpen(true);
  }

  function handleSaveMember(input: Parameters<typeof addMember>[0]) {
    if (editingMember) {
      void updateMember(editingMember.id, input);
    } else {
      void addMember(input);
    }
  }

  return (
    <>
      <SettingsSectionHeader>Familie</SettingsSectionHeader>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexDirection: { xs: "column", sm: "row" },
              gap: 1.5,
              mb: 2.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Avatar sx={{ bgcolor: "primary.main" }}>
                <FamilyRestroomRounded />
              </Avatar>

              <Box>
                <Typography variant="h6">Familien</Typography>

                <Typography variant="body2" color="text.secondary">
                  Administrer familiens profiler
                </Typography>
              </Box>
            </Box>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAddMember}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              Tilføj familiemedlem
            </Button>
          </Box>

          <Box sx={{ display: "grid", gap: 0 }}>
            {members.map((member, index) => {
              const mappedCalendarId = getCalendarIdForOwner(member.id);
              const mappedCalendarLabel = mappedCalendarId
                ? calendarLabelByRawId.get(mappedCalendarId)
                : undefined;

              return (
                <Box key={member.id}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      py: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        flexGrow: 1,
                      }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: member.color,
                          width: 42,
                          height: 42,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(member.name)}
                      </Avatar>

                      <Box sx={{ textAlign: "left", flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }}>{member.name}</Typography>

                        <Typography variant="body2" color="text.secondary">
                          {member.relation ?? "Delt profil"}
                        </Typography>

                        {mappedCalendarLabel && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <CalendarMonthRounded sx={{ fontSize: 14 }} />
                            {mappedCalendarLabel}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    <IconButton
                      aria-label={`Rediger ${member.name}`}
                      onClick={() => handleOpenEditMember(member)}
                    >
                      <ChevronRightRounded />
                    </IconButton>
                  </Box>

                  {index < members.length - 1 && <Divider />}
                </Box>
              );
            })}
          </Box>

          <Divider sx={{ my: 1 }} />

          <SettingsLinkRow
            icon={<GroupAddRounded color="action" />}
            title="Inviter familiemedlem"
            subtitle="Del en invitationskode"
            onClick={() => setIsInviteDialogOpen(true)}
          />

          <Divider />

          <SettingsLinkRow
            icon={<ManageAccountsRounded color="action" />}
            title="Medlemmer og roller"
            subtitle="Se konti, skift rolle, fjern adgang"
            onClick={() => setIsMembershipsDialogOpen(true)}
          />

          <Divider />

          <SettingsLinkRow
            icon={<LinkRounded color="action" />}
            title="Del kalender"
            subtitle="Offentligt link til udenforstående"
            onClick={() => setIsShareDialogOpen(true)}
          />
        </CardContent>
      </Card>

      <FamilyMemberDialog
        open={isMemberDialogOpen}
        member={editingMember}
        onClose={() => setIsMemberDialogOpen(false)}
        onSave={handleSaveMember}
        onDelete={deleteMember}
      />

      <InviteCodeDialog open={isInviteDialogOpen} onClose={() => setIsInviteDialogOpen(false)} />

      <FamilyMembershipsDialog
        open={isMembershipsDialogOpen}
        onClose={() => setIsMembershipsDialogOpen(false)}
      />

      <ShareLinkDialog open={isShareDialogOpen} onClose={() => setIsShareDialogOpen(false)} />
    </>
  );
}
