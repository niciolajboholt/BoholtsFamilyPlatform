import { Box, Container } from '@mui/material'
import { AppRouter } from './app/AppRouter'

function App() {
  return (
    <Box sx={{ minHeight: '100vh', py: 4 }}>
      <Container maxWidth="md">
        <AppRouter />
      </Container>
    </Box>
  )
}

export default App