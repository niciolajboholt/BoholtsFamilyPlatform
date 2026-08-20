import { AppRouter } from './app/AppRouter'
import { ErrorBoundary } from './app/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  )
}

export default App