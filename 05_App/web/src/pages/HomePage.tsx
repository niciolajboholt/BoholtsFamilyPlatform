import { Card, CardContent, Stack, Typography } from '@mui/material'

export function HomePage() {
  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h1">Familiens overblik</Typography>

        <Typography color="text.secondary">
          Familiens planer samlet ét sted.
        </Typography>
      </div>

      <Card>
        <CardContent>
          <Typography variant="h2">I dag</Typography>

          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Der er endnu ingen aftaler i kalenderen.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  )
}