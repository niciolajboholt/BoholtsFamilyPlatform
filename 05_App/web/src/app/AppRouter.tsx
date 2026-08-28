import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CircularProgress, Box } from '@mui/material'
import AppLayout from '../layouts/AppLayout'

// Route-baseret code-splitting: hver side bliver sit eget chunk, hentet
// først når brugeren rent faktisk navigerer dertil, i stedet for at hele
// appen (inkl. fx Outlook-integrationens @azure/msal-browser, kun brugt
// fra SettingsPage) skal loades på forhånd. Vite advarede om ét ~930 kB
// bundle ved hvert build — relevant for en PWA på mobilt netværk.
const HomePage = lazy(() => import('../pages/HomePage'))
const CalendarPage = lazy(() => import('../pages/CalendarPage'))
const ShoppingListPage = lazy(() => import('../pages/ShoppingListPage'))
const TasksPage = lazy(() => import('../pages/TasksPage'))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const PublicSharedCalendarPage = lazy(() => import('../pages/PublicSharedCalendarPage'))
const LegalPage = lazy(() => import('../pages/LegalPage'))

function RouteLoadingFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Sprint 26: uden for AppLayout bevidst — /share/:token skal aldrig
              gå gennem login-gaten (AppLayout's useSession-tjek). */}
          <Route path="share/:token" element={<PublicSharedCalendarPage />} />
          <Route path="privacy" element={<LegalPage kind="privacy" />} />
          <Route path="terms" element={<LegalPage kind="terms" />} />

          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="shopping-list" element={<ShoppingListPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
