import type { ReactNode } from "react";

import { ChevronRightRounded } from "@mui/icons-material";
import { Box, ButtonBase, Typography } from "@mui/material";

export function SettingsSectionHeader({ children }: { children: string }) {
  return (
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{ fontWeight: 700, letterSpacing: "0.08em", mt: 1, ml: 0.5 }}
    >
      {children}
    </Typography>
  );
}

export function SettingsLinkRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        py: 1.5,
        px: 0.5,
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexGrow: 1 }}>
        {icon}
        <Box sx={{ textAlign: "left", flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
      </Box>
      <ChevronRightRounded color="action" />
    </ButtonBase>
  );
}
