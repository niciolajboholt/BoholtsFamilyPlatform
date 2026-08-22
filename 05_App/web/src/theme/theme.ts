import { createTheme } from "@mui/material/styles";
import type { PaletteMode, Theme } from "@mui/material/styles";

// Sprint 30: mørkt tema — de to paletter deler samme identitet (varm grøn
// primærfarve, rav-accent, ingen blå), men farverne er selvstændigt
// afstemt pr. tilstand i stedet for blot invers af hinanden, så kontrasten
// mod hver baggrund forbliver god (fx er primærfarven lysnet i mørk
// tilstand, ellers ville den fremstå mat mod den mørke baggrund).
const lightPalette = {
  mode: "light" as const,

  primary: {
    main: "#2F6B4F",
  },

  secondary: {
    main: "#B5722E",
  },

  background: {
    default: "#F6F5EF",
    paper: "#FFFFFF",
  },

  success: {
    main: "#43A047",
  },

  warning: {
    main: "#FB8C00",
  },

  error: {
    main: "#E53935",
  },

  text: {
    primary: "#1F2937",
    secondary: "#6B7280",
  },
};

const darkPalette = {
  mode: "dark" as const,

  primary: {
    main: "#5CBE8D",
  },

  secondary: {
    main: "#D9944F",
  },

  background: {
    default: "#17191A",
    paper: "#20231F",
  },

  success: {
    main: "#66BB6A",
  },

  warning: {
    main: "#FFB74D",
  },

  error: {
    main: "#EF5350",
  },

  text: {
    primary: "#EDEBE3",
    secondary: "#A6A499",
  },
};

export function createAppTheme(mode: PaletteMode): Theme {
  const palette = mode === "dark" ? darkPalette : lightPalette;

  return createTheme({
    palette,

    shape: {
      borderRadius: 16,
    },

    typography: {
      fontFamily: `"Inter","Roboto","Helvetica","Arial",sans-serif`,

      h4: {
        fontWeight: 700,
      },

      h5: {
        fontWeight: 700,
      },

      h6: {
        fontWeight: 600,
      },

      button: {
        textTransform: "none",
        fontWeight: 600,
      },
    },

    spacing: 8,

    components: {
      MuiCard: {
        styleOverrides: {
          root:
            mode === "dark"
              ? {
                  borderRadius: 18,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                  // Skygger læses dårligt mod en tilsvarende mørk baggrund
                  // — en svag kant giver kortet den samme visuelle
                  // adskillelse fra siden, som skyggen giver i lys tilstand.
                  border: "1px solid rgba(255,255,255,0.08)",
                }
              : {
                  borderRadius: 18,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                },
        },
      },

      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            paddingLeft: 18,
            paddingRight: 18,
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: "none",
          },
        },
      },
    },
  });
}

const theme = createAppTheme("light");

export default theme;
