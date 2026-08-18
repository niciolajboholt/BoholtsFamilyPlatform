import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import CalendarPage from '../pages/CalendarPage'
import HomePage from "../pages/HomePage";
import PublicSharedCalendarPage from "../pages/PublicSharedCalendarPage";
import ShoppingListPage from "../pages/ShoppingListPage";
import SettingsPage from "../pages/SettingsPage";
import TasksPage from "../pages/TasksPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Sprint 26: uden for AppLayout bevidst — /share/:token skal aldrig
            gå gennem login-gaten (AppLayout's useSession-tjek). */}
        <Route path="share/:token" element={<PublicSharedCalendarPage />} />

        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="shopping-list" element={<ShoppingListPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}