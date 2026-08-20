import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

// Sprint 29: en uventet frontend-fejl gav hidtil en helt tom, hvid app —
// ingen indikation til brugeren om at noget gik galt, og ingen vej videre
// uden at kende til at genindlæse siden manuelt.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('Ufanget frontend-fejl:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 3,
            textAlign: 'center',
          }}
        >
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            <Typography variant="h6">Der gik noget galt</Typography>
            <Typography color="text.secondary">
              Appen stødte på en uventet fejl. Prøv at genindlæse siden.
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Genindlæs
            </Button>
          </Stack>
        </Box>
      )
    }

    return this.props.children
  }
}
