import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { daDK } from '@mui/x-date-pickers/locales'
import { da } from 'date-fns/locale'
import './index.css'
import App from './App.tsx'
import { ThemeModeProvider } from './theme/ThemeModeProvider'

// adapterLocale (date-fns) styrer kun selve datoformatet (fx "25. august"
// frem for "August 25") — MUI's egen UI-tekst i kalender-popup'en ("Select
// date", "Cancel", "OK" m.m.) er en helt separat oversættelse, der ellers
// forbliver engelsk, uanset adapterLocale.
const { components } = daDK

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeModeProvider>
      <LocalizationProvider
        dateAdapter={AdapterDateFns}
        adapterLocale={da}
        localeText={components.MuiLocalizationProvider.defaultProps.localeText}
      >
        <App />
      </LocalizationProvider>
    </ThemeModeProvider>
  </StrictMode>,
)
