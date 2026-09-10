import { useEffect, useState } from "react";

import { CakeRounded, CardGiftcardRounded } from "@mui/icons-material";
import { Avatar, Box, Card, CardContent, Divider, IconButton, TextField, Typography } from "@mui/material";

import { getInitials } from "../../calendar/utils/getInitials";
import type { FamilyMemberDto } from "../../family/familyApi";
import { getMyFamily, updateFamilyMember } from "../../family/familyApi";
import { useEnabledFeatures } from "../../family/hooks/useEnabledFeatures";
import { BirthdayGiftPlansDialog } from "./BirthdayGiftPlansDialog";
import { SettingsSectionHeader } from "./SettingsPrimitives";

const monthDayPattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function BirthdayRow({
  familyId,
  member,
  onOpenGiftPlans,
  onBirthdayChanged,
}: {
  familyId: string;
  member: FamilyMemberDto;
  onOpenGiftPlans: () => void;
  onBirthdayChanged: (memberId: string, birthday: string | null) => void;
}) {
  const [value, setValue] = useState(member.birthday ?? "");
  const [error, setError] = useState(false);

  function commit(): void {
    const trimmed = value.trim();

    if (!trimmed) {
      setError(false);
      onBirthdayChanged(member.id, null);
      void updateFamilyMember(familyId, member.id, { birthday: null });
      return;
    }

    if (!monthDayPattern.test(trimmed)) {
      setError(true);
      return;
    }

    setError(false);
    onBirthdayChanged(member.id, trimmed);
    void updateFamilyMember(familyId, member.id, { birthday: trimmed });
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5 }}>
      <Avatar sx={{ bgcolor: member.color, width: 36, height: 36, fontSize: 14, fontWeight: 700 }}>
        {getInitials(member.name)}
      </Avatar>

      <Typography sx={{ flexGrow: 1, minWidth: 0, fontWeight: 600 }}>{member.name}</Typography>

      <TextField
        size="small"
        placeholder="MM-DD"
        value={value}
        error={error}
        helperText={error ? "Format: MM-DD" : undefined}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        sx={{ width: 110 }}
      />

      <IconButton aria-label={`Gaveideer til ${member.name}`} onClick={onOpenGiftPlans}>
        <CardGiftcardRounded />
      </IconButton>
    </Box>
  );
}

// Sprint 40: fødselsdato (MM-DD, bevidst uden år) pr. familiemedlem, og en
// genvej til gaveideer pr. medlem. Henter familiedata direkte her (ikke via
// calendar-featurets useFamilyMembers/CalendarOwner-lag ovenfor i
// FamilySection) — den er en localStorage-cachet model bygget til
// kalendertildeling, ikke det rette sted at udvide med nye
// familiemedlem-felter, der ikke har noget med kalenderen at gøre.
export function BirthdaysSection() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const [giftPlansMember, setGiftPlansMember] = useState<FamilyMemberDto | null>(null);
  const { isEnabled } = useEnabledFeatures();

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then((result) => {
      if (!isCancelled && result.ok && result.data.family) {
        setFamilyId(result.data.family.id);
        // Pseudomedlemmet ("Familien", relation === null) har ingen egen
        // fødselsdag og udelades derfor her.
        setMembers((result.data.members ?? []).filter((member) => member.relation !== null));
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  function handleBirthdayChanged(memberId: string, birthday: string | null): void {
    setMembers((current) =>
      current.map((member) => (member.id === memberId ? { ...member, birthday } : member)),
    );
  }

  if (!familyId || members.length === 0 || !isEnabled("birthdays")) {
    return null;
  }

  return (
    <>
      <SettingsSectionHeader>Fødselsdage og gaver</SettingsSectionHeader>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Avatar sx={{ bgcolor: "primary.main" }}>
              <CakeRounded />
            </Avatar>

            <Typography variant="body2" color="text.secondary">
              Sæt fødselsdage og saml gaveideer — en gaveplan er skjult for
              den, den er lavet til.
            </Typography>
          </Box>

          {members.map((member, index) => (
            <Box key={member.id}>
              <BirthdayRow
                familyId={familyId}
                member={member}
                onOpenGiftPlans={() => setGiftPlansMember(member)}
                onBirthdayChanged={handleBirthdayChanged}
              />
              {index < members.length - 1 && <Divider />}
            </Box>
          ))}
        </CardContent>
      </Card>

      {giftPlansMember && (
        <BirthdayGiftPlansDialog
          open={Boolean(giftPlansMember)}
          onClose={() => setGiftPlansMember(null)}
          familyId={familyId}
          memberId={giftPlansMember.id}
          memberName={giftPlansMember.name}
        />
      )}
    </>
  );
}
