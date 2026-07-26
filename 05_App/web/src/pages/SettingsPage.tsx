import { Card, CardContent, Stack, Typography } from '@mui/material'

export function SettingsPage() {
  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h1">Indstillinger</Typography>

        <Typography color="text.secondary">
          Administrér familie, personer og kalenderforbindelser.
        </Typography>
      </div>

      <Card>
        <CardContent>
          <Typography variant="h2">Familie</Typography>

          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Familieindstillinger tilføjes senere.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  )
}