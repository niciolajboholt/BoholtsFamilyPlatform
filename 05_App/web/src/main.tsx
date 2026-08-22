import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { da } from 'date-fns/locale'
import './index.css'
import App from './App.tsx'
import { ThemeModeProvider } from './theme/ThemeModeProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeModeProvider>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={da}>
        <App />
      </LocalizationProvider>
    </ThemeModeProvider>
  </StrictMode>,
)
