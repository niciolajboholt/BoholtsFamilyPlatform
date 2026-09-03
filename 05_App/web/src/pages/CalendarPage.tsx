import AddIcon from "@mui/icons-material/Add";
import { CloudDoneRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";

import CalendarToolbar from "../features/calendar/components/CalendarToolbar";
import { CalendarSourceFilter } from "../features/calendar/components/CalendarSourceFilter";
import DayCalendar from "../features/calendar/components/DayCalendar";
import EditEventDialog from "../features/calendar/components/EditEventDialog";
import EventList from "../features/calendar/components/EventList";
import { ExternalCalendarConnectionBanner } from "../features/calendar/components/ExternalCalendarConnectionBanner";
import FamilyPlannerCalendar from "../features/calendar/components/FamilyPlannerCalendar";
import MonthCalendar from "../features/calendar/components/MonthCalendar";
import NewEventDialog from "../features/calendar/components/NewEventDialog";
import WeekCalendar from "../features/calendar/components/WeekCalendar";
import { useCalendarPageController } from "../features/calendar/hooks/useCalendarPageController";

function CalendarPage() {
  const {
    selectedDate,
    calendarView,
    visibleDate,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    longPressCreateDate,
    setLongPressCreateDate,
    handleLongPressCreate,
    selectedEvent,
    snackbar,
    events,
    hasLoadedEvents,
    isLoading,
    isSaving,
    error,
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
    recurrenceExceptions,
    isGoogleCalendarStatusLoading,
    isGoogleCalendarConnected,
    isOutlookCalendarConfigured,
    outlookCalendarConfigurationError,
    isOutlookCalendarConnected,
    wasOutlookCalendarEverConnected,
    isAttemptingOutlookSilentReconnect,
    connectedProviderLabels,
    isInitialLoading,
    isInitialSourceLoading,
    isRefreshing,
    viewerEvents,
    visibleEvents,
    conflictEventIds,
    sourceFilteredRawEvents,
    eventsForSelectedDate,
    swipeNavigation,
    handleCloseSnackbar,
    handleSelectDate,
    handleOpenDayFromWeek,
    handlePrevious,
    handleNext,
    handleToday,
    handleChangeView,
    handleCreateEvent,
    handleSelectEvent,
    handleCloseEditDialog,
    handleUpdateEvent,
    handleDeleteEvent,
    handleUndoDelete,
  } = useCalendarPageController();

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: "auto",
        pb: 4,
      }}
    >
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: {
            xs: "stretch",
            sm: "center",
          },
          justifyContent:
            "space-between",
          flexDirection: {
            xs: "column",
            sm: "row",
          },
          gap: 2,
        }}
      >
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography variant="h4">
              Kalender
            </Typography>

            {connectedProviderLabels.length > 0 && (
              <Tooltip
                title={`${connectedProviderLabels.join(" og ")} Kalender: Synkroniseret`}
                enterTouchDelay={0}
              >
                <CloudDoneRounded
                  color="success"
                  fontSize="small"
                  aria-label={`${connectedProviderLabels.join(" og ")} Kalender er synkroniseret`}
                />
              </Tooltip>
            )}
          </Box>

          <Typography
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            Familiens aftaler samlet
            ét sted.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            setIsNewEventDialogOpen(
              true,
            )
          }
        >
          Ny aftale
        </Button>
      </Box>

      {!isGoogleCalendarStatusLoading && (
        <ExternalCalendarConnectionBanner
          providerLabel="Google"
          isConfigured
          isConnected={isGoogleCalendarConnected}
          wasEverConnected
          isAttemptingSilentReconnect={false}
          health={providerHealth.find(
            (health) => health.providerId === "google",
          )}
          onRetry={() => {
            void refreshEvents();
            void refreshCalendarSources();
          }}
        />
      )}

      {/*
        Outlook er midlertidigt slået fra uden en configurationError (se
        outlookCalendarConfig.ts) — vises slet ikke her, mens den er ukonfigureret,
        i stedet for en "ikke konfigureret"-boks ingen kan handle på endnu.
        Dukker automatisk op igen, når Outlook genaktiveres.
      */}
      {isOutlookCalendarConfigured && (
      <ExternalCalendarConnectionBanner
        providerLabel="Outlook"
        isConfigured={isOutlookCalendarConfigured}
        configurationError={outlookCalendarConfigurationError}
        isConnected={isOutlookCalendarConnected}
        wasEverConnected={wasOutlookCalendarEverConnected}
        isAttemptingSilentReconnect={isAttemptingOutlookSilentReconnect}
        health={providerHealth.find(
          (health) => health.providerId === "outlook",
        )}
        onRetry={() => {
          void refreshEvents();
          void refreshCalendarSources();
        }}
      />
      )}

      <Card sx={{ mb: 2.5 }}>
        <CardContent
          sx={{ p: 2.5 }}
        >
          <CalendarSourceFilter
            calendarSources={calendarSources}
            visibleCalendarSourceIds={visibleCalendarSourceIds}
            events={viewerEvents}
            members={members}
            isLoading={isLoadingCalendarSources}
            error={calendarSourcesError}
            onToggle={toggleCalendarSource}
            onShowAll={showAllCalendarSources}
            onRetry={() => { void refreshCalendarSources(); }}
          />
        </CardContent>
      </Card>

      <CalendarToolbar
        calendarView={
          calendarView
        }
        visibleDate={visibleDate}
        onPrevious={
          handlePrevious
        }
        onNext={handleNext}
        onToday={handleToday}
        onChangeView={
          handleChangeView
        }
      />

      {isInitialLoading || isInitialSourceLoading ? (
        <Card sx={{ mb: 2.5 }}>
          <CardContent>
            <Box
              role="status"
              sx={{
                minHeight: 180,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <CircularProgress />

              <Typography>
                Indlæser kalender…
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : error && !hasLoadedEvents ? (
        <Alert
          severity="error"
          action={
            <Button
              aria-label="Prøv at indlæse kalenderen igen"
              color="inherit"
              size="small"
              disabled={isLoading}
              onClick={() => {
                void refreshEvents();
              }}
            >
              Prøv igen
            </Button>
          }
          sx={{ mb: 2.5 }}
        >
          Kalenderen kunne ikke indlæses.
        </Alert>
      ) : (
        <>
          {isRefreshing && (
            <Box
              role="status"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 1.5,
              }}
            >
              <CircularProgress size={18} />

              <Typography variant="body2">
                Opdaterer kalender…
              </Typography>
            </Box>
          )}

          {error && (
            <Alert
              severity="warning"
              action={
                <Button
                  aria-label="Prøv at indlæse kalenderen igen"
                  color="inherit"
                  size="small"
                  disabled={isLoading}
                  onClick={() => {
                    void refreshEvents();
                  }}
                >
                  Prøv igen
                </Button>
              }
              sx={{ mb: 2.5 }}
            >
              Kalenderen kunne ikke opdateres. De senest indlæste aftaler vises.
            </Alert>
          )}

          {visibleCalendarSourceIds.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2.5 }} action={<Button color="inherit" size="small" onClick={showAllCalendarSources}>Vis alle kalendere</Button>}>
              Ingen kalendere er valgt.
            </Alert>
          ) : events.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2.5 }}>
              Ingen aftaler endnu.
            </Alert>
          ) : visibleEvents.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2.5 }}>
              Ingen aftaler matcher de valgte kalendere.
            </Alert>
          ) : null}

      <Box
        {...(calendarView === "planner" ? {} : swipeNavigation)}
        sx={
          calendarView === "planner"
            ? undefined
            // Frigør vandrette strøg til vores egen pointer-håndtering i
            // stedet for at lade browseren først forsøge at fortolke dem som
            // sin egen pan/scroll-gestus (hvilket ellers kunne kræve et
            // urealistisk langt strøg, før det overhovedet blev registreret)
            // — lodret scroll (fx dagvisningens tidslinje) er upåvirket.
            : { touchAction: "pan-y" }
        }
      >
      {calendarView === "month" ? (
        <MonthCalendar
          visibleMonth={visibleDate}
          selectedDate={selectedDate}
          events={visibleEvents}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectDate={handleSelectDate}
          onSelectEvent={handleSelectEvent}
          onLongPressCreate={handleLongPressCreate}
        />
      ) : calendarView === "week" ? (
        <WeekCalendar
          selectedDate={selectedDate}
          events={visibleEvents}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectDate={handleOpenDayFromWeek}
          onSelectEvent={handleSelectEvent}
          onLongPressCreate={handleLongPressCreate}
        />
      ) : calendarView === "day" ? (
        <DayCalendar
          selectedDate={selectedDate}
          events={visibleEvents}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectEvent={handleSelectEvent}
          onLongPressCreate={handleLongPressCreate}
        />
      ) : (
        <FamilyPlannerCalendar
          visibleDate={visibleDate}
          events={sourceFilteredRawEvents}
          recurrenceExceptions={recurrenceExceptions.exceptions}
          members={members}
          onSelectEvent={handleSelectEvent}
        />
      )}
      </Box>

      {calendarView === "month" && (
        <EventList
          selectedDate={selectedDate}
          events={eventsForSelectedDate}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectEvent={handleSelectEvent}
        />
      )}
        </>
      )}

      <NewEventDialog
        open={isNewEventDialogOpen}
        initialDate={longPressCreateDate ?? selectedDate}
        events={viewerEvents}
        calendarSources={calendarSources}
        members={members}
        isSaving={isSaving}
        onClose={() => {
          setIsNewEventDialogOpen(false);
          setLongPressCreateDate(null);
        }}
        onCreate={handleCreateEvent}
      />

      <EditEventDialog
        open={selectedEvent !== null}
        event={selectedEvent}
        events={viewerEvents}
        calendarSources={calendarSources}
        members={members}
        isSaving={isSaving}
        onClose={handleCloseEditDialog}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
        onUpdateOccurrence={recurrenceExceptions.modifyOccurrence}
        onDeleteOccurrence={recurrenceExceptions.cancelOccurrence}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={
          snackbar.showUndo
            ? 6000
            : 3000
        }
        onClose={
          handleCloseSnackbar
        }
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        <Alert
          severity={
            snackbar.severity
          }
          variant="filled"
          onClose={
            handleCloseSnackbar
          }
          action={
            snackbar.showUndo ? (
              <Button
                color="inherit"
                size="small"
                disabled={isSaving}
                onClick={() => {
                  void handleUndoDelete();
                }}
              >
                Fortryd
              </Button>
            ) : undefined
          }
          sx={{
            width: "100%",
            alignItems: "center",
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default CalendarPage;
