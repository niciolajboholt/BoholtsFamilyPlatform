import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',

    primary: {
      main: '#2E7D32',
    },

    secondary: {
      main: '#1565C0',
    },

    background: {
      default: '#F7F8FA',
      paper: '#FFFFFF',
    },
  },

  shape: {
    borderRadius: 14,
  },

  typography: {
    fontFamily: [
      'Inter',
      'Segoe UI',
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),

    h1: {
      fontWeight: 700,
      fontSize: '2rem',
    },

    h2: {
      fontWeight: 700,
      fontSize: '1.4rem',
    },

    h3: {
      fontWeight: 600,
      fontSize: '1.2rem',
    },
  },
})