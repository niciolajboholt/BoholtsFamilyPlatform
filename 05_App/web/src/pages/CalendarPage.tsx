import { Box, Card, CardContent } from "@mui/material";

import { CalendarBody } from "../features/calendar/components/CalendarBody";
import { CalendarConnectionBanners } from "../features/calendar/components/CalendarConnectionBanners";
import { CalendarDialogs } from "../features/calendar/components/CalendarDialogs";
import { CalendarPageHeader } from "../features/calendar/components/CalendarPageHeader";
import CalendarToolbar from "../features/calendar/components/CalendarToolbar";
import { CalendarSourceFilter } from "../features/calendar/components/CalendarSourceFilter";
import { useCalendarPageController } from "../features/calendar/hooks/useCalendarPageController";

function CalendarPage() {
  const controller = useCalendarPageController();
  const {
    calendarView,
    visibleDate,
    setIsNewEventDialogOpen,
    providerHealth,
    calendarSources,
    visibleCalendarSourceIds,
    isLoadingCalendarSources,
    calendarSourcesError,
    toggleCalendarSource,
    showAllCalendarSources,
    refreshCalendarSources,
    refreshEvents,
    members,
    viewerEvents,
    isGoogleCalendarStatusLoading,
    isGoogleCalendarConnected,
    isOutlookCalendarConfigured,
    outlookCalendarConfigurationError,
    isOutlookCalendarConnected,
    wasOutlookCalendarEverConnected,
    isAttemptingOutlookSilentReconnect,
    connectedProviderLabels,
    handlePrevious,
    handleNext,
    handleToday,
    handleChangeView,
  } = controller;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", pb: 4 }}>
      <CalendarPageHeader
        connectedProviderLabels={connectedProviderLabels}
        onCreateEvent={() => setIsNewEventDialogOpen(true)}
      />

      <CalendarConnectionBanners
        isGoogleCalendarStatusLoading={isGoogleCalendarStatusLoading}
        isGoogleCalendarConnected={isGoogleCalendarConnected}
        isOutlookCalendarConfigured={isOutlookCalendarConfigured}
        outlookCalendarConfigurationError={outlookCalendarConfigurationError}
        isOutlookCalendarConnected={isOutlookCalendarConnected}
        wasOutlookCalendarEverConnected={wasOutlookCalendarEverConnected}
        isAttemptingOutlookSilentReconnect={isAttemptingOutlookSilentReconnect}
        providerHealth={providerHealth}
        onRetry={() => {
          void refreshEvents();
          void refreshCalendarSources();
        }}
      />

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5 }}>
          <CalendarSourceFilter
            calendarSources={calendarSources}
            visibleCalendarSourceIds={visibleCalendarSourceIds}
            events={viewerEvents}
            members={members}
            isLoading={isLoadingCalendarSources}
            error={calendarSourcesError}
            onToggle={toggleCalendarSource}
            onShowAll={showAllCalendarSources}
            onRetry={() => {
              void refreshCalendarSources();
            }}
          />
        </CardContent>
      </Card>

      <CalendarToolbar
        calendarView={calendarView}
        visibleDate={visibleDate}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        onChangeView={handleChangeView}
      />

      <CalendarBody {...controller} />

      <CalendarDialogs {...controller} />
    </Box>
  );
}

export default CalendarPage;
