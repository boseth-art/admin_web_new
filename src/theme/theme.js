import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2DD4BF',
      light: '#5EEAD4',
      dark: '#0D9488',
      contrastText: '#0D1B2A',
    },
    secondary: {
      main: '#6366F1',
      light: '#818CF8',
      dark: '#4338CA',
    },
    success: {
      main: '#34D399',
      light: '#6EE7B7',
    },
    warning: {
      main: '#FBBF24',
    },
    error: {
      main: '#F87171',
    },
    background: {
      default: '#070D18',
      paper: '#0D1B2A',
    },
    surface: {
      card: '#111E2E',
      elevated: '#172435',
      border: 'rgba(45,212,191,0.12)',
    },
    text: {
      primary: '#F0F6FF',
      secondary: '#94A3B8',
      disabled: '#475569',
    },
    divider: 'rgba(45,212,191,0.1)',
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    h1: { fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.015em' },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 500, color: '#94A3B8' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(135deg, #070D18 0%, #0D1B2A 50%, #070D18 100%)',
          minHeight: '100vh',
          scrollbarWidth: 'thin',
          scrollbarColor: '#2DD4BF33 transparent',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(45,212,191,0.25)',
            borderRadius: 3,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: 'rgba(13,27,42,0.85)',
          border: '1px solid rgba(45,212,191,0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: 'rgba(17,30,46,0.9)',
          border: '1px solid rgba(45,212,191,0.12)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 32px rgba(45,212,191,0.12)',
            borderColor: 'rgba(45,212,191,0.25)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
          fontWeight: 600,
          fontSize: '0.9rem',
          transition: 'all 0.2s ease',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #2DD4BF, #0D9488)',
          boxShadow: '0 4px 20px rgba(45,212,191,0.35)',
          color: '#0D1B2A',
          '&:hover': {
            background: 'linear-gradient(135deg, #5EEAD4, #2DD4BF)',
            boxShadow: '0 6px 28px rgba(45,212,191,0.5)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            background: 'rgba(7,13,24,0.6)',
            transition: 'all 0.2s ease',
            '& fieldset': { borderColor: 'rgba(45,212,191,0.2)' },
            '&:hover fieldset': { borderColor: 'rgba(45,212,191,0.4)' },
            '&.Mui-focused fieldset': {
              borderColor: '#2DD4BF',
              boxShadow: '0 0 0 3px rgba(45,212,191,0.1)',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: '0.75rem' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            background: 'rgba(45,212,191,0.06)',
            color: '#94A3B8',
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background 0.15s ease',
          '&:hover': { background: 'rgba(45,212,191,0.04)' },
          '&:last-child td': { border: 0 },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: 'rgba(45,212,191,0.08)', padding: '14px 16px' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6, background: 'rgba(45,212,191,0.1)' },
        bar: { background: 'linear-gradient(90deg, #2DD4BF, #6366F1)' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(7,13,24,0.95)',
          borderRight: '1px solid rgba(45,212,191,0.1)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(7,13,24,0.85)',
          borderBottom: '1px solid rgba(45,212,191,0.1)',
          backdropFilter: 'blur(20px)',
          boxShadow: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: '2px 8px',
          transition: 'all 0.2s ease',
          '&.Mui-selected': {
            background: 'linear-gradient(135deg, rgba(45,212,191,0.18), rgba(45,212,191,0.08))',
            borderLeft: '3px solid #2DD4BF',
            '& .MuiListItemIcon-root': { color: '#2DD4BF' },
            '& .MuiListItemText-primary': { color: '#2DD4BF', fontWeight: 600 },
            '&:hover': { background: 'rgba(45,212,191,0.22)' },
          },
          '&:hover': { background: 'rgba(45,212,191,0.08)' },
        },
      },
    },
  },
});

export default theme;
