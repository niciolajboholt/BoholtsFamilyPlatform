import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",

    // Varm mørkegrøn — appens egen identitet i stedet for standard
    // Material-blå. Matcher theme-color i index.html/manifestet.
    primary: {
      main: "#2F6B4F",
    },

    // Varm rav/terracotta som eneste accentfarve — bevidst IKKE blå, så
    // blå ikke optræder som en anden "systemfarve" ved siden af det grønne.
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
  },

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
        root: {
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

export default theme;