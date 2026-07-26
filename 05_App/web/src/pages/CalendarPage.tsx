import { Card, CardContent, Stack, Typography } from '@mui/material'

export function CalendarPage() {
  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h1">Kalender</Typography>

        <Typography color="text.secondary">
          Familie-, person- og arbejdskalendere kommer her.
        </Typography>
      </div>

      <Card>
        <CardContent>
          <Typography variant="h2">Kalendervisning</Typography>

          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Kalenderfunktionen udvikles i en kommende sprint.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  )
}