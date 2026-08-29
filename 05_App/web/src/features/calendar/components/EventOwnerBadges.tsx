import { Box } from "@mui/material";

import type { EventOwnerBadge } from "../utils/getEventOwnerColor";

interface EventOwnerBadgesProps {
  owners: readonly EventOwnerBadge[];
  sizePx?: number;
  // Kun sat, hvis den omkringliggende knap/kort ikke allerede har sit eget
  // aria-label med ejernavnene — undgår at skærmlæsere annoncerer navnet
  // to gange.
  ariaHidden?: boolean;
}

/**
 * Lille, farvet cirkel med ejerens forbogstav — det synlige alternativ til
 * kun at farvelægge et aftalekort (WCAG 1.4.1 "Use of Color"). Viser højst
 * 3 badges for at holde sig inden for måned-/dagsvisningens meget
 * begrænsede plads; resten er stadig dækket af kortets fulde farvestribe.
 */
function EventOwnerBadges({
  owners,
  sizePx = 16,
  ariaHidden = true,
}: EventOwnerBadgesProps) {
  if (owners.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        // Let overlap i stedet for luft mellem badges, så flere ejere ikke
        // fylder mere end nødvendigt i den smalle plads.
        "& > *:not(:first-of-type)": { ml: `-${Math.round(sizePx * 0.3)}px` },
      }}
    >
      {owners.slice(0, 3).map((owner) => (
        <Box
          key={owner.id}
          aria-hidden={ariaHidden}
          title={ariaHidden ? undefined : owner.name}
          sx={{
            width: sizePx,
            height: sizePx,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: owner.color,
            border: "1px solid",
            borderColor: "background.paper",
            color: "#ffffff",
            fontSize: `${Math.round(sizePx * 0.55)}px`,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {owner.name.charAt(0).toUpperCase()}
        </Box>
      ))}
    </Box>
  );
}

export default EventOwnerBadges;
