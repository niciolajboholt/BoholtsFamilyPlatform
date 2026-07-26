import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Container,
  Paper,
  Toolbar,
  Typography,
} from '@mui/material'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const navigationItems = [
  {
    label: 'Overblik',
    path: '/',
    icon: <HomeOutlinedIcon />,
  },
  {
    label: 'Kalender',
    path: '/calendar',
    icon: <CalendarMonthOutlinedIcon />,
  },
  {
    label: 'Indstillinger',
    path: '/settings',
    icon: <SettingsOutlinedIcon />,
  },
]

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        pb: 10,
      }}
    >
      <AppBar position="sticky" elevation={0}>
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{ fontWeight: 700 }}
          >
            Boholts Family Platform
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3 }}>
        <Outlet />
      </Container>

      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 1200,
        }}
      >
        <BottomNavigation
          value={location.pathname}
          onChange={(_, newPath: string) => navigate(newPath)}
          showLabels
        >
          {navigationItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              value={item.path}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  )
}