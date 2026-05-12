import { createTheme } from '@mui/material/styles';

const green = {
  50: '#eef7ee',
  100: '#d8ead8',
  200: '#b8d8b8',
  300: '#91c091',
  400: '#65a265',
  500: '#3f843f',
  600: '#2d6a2d',
  700: '#245824',
  800: '#1c421c',
  900: '#162716'
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: green[600],
      light: green[50],
      dark: green[900]
    },
    secondary: {
      main: '#526252'
    },
    success: {
      main: green[600],
      light: green[50]
    },
    background: {
      default: '#f8fcf8',
      paper: '#ffffff'
    },
    divider: '#e0ede0',
    text: {
      primary: green[900],
      secondary: '#526252'
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
    h1: { fontSize: 40, fontWeight: 800, letterSpacing: '-0.022em', lineHeight: 1.05 },
    h2: { fontSize: 32, fontWeight: 800, letterSpacing: '-0.018em', lineHeight: 1.1 },
    h3: { fontSize: 24, fontWeight: 800, letterSpacing: '-0.012em', lineHeight: 1.15 },
    h4: { fontSize: 20, fontWeight: 800, letterSpacing: '-0.008em', lineHeight: 1.2 },
    h5: { fontSize: 16, fontWeight: 700, letterSpacing: 0, lineHeight: 1.25 },
    h6: { fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase' as const },
    body1: { fontSize: 14, fontWeight: 500, lineHeight: 1.5 },
    body2: { fontSize: 12, fontWeight: 500, lineHeight: 1.5 },
    caption: { fontSize: 11, fontWeight: 500, color: '#526252' },
    button: { textTransform: 'none' as const, fontWeight: 600, letterSpacing: 0 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          '--g50': green[50],
          '--g100': green[100],
          '--g200': green[200],
          '--g300': green[300],
          '--g400': green[400],
          '--g500': green[500],
          '--g600': green[600],
          '--g700': green[700],
          '--g800': green[800],
          '--g900': green[900],
          '--crm-border': '#e0ede0',
          '--crm-bg': '#f8fcf8',
          '--crm-sidebar': green[900],
          '--crm-primary': green[600],
          '--crm-paper': '#ffffff',
          '--crm-paper-soft': '#fafdfa',
          '--crm-soft': '#eef7ee',
          '--crm-muted': '#526252',
          '--crm-border-strong': '#cfe1cf',
          '--status-slate-bg': '#f1f5f1',
          '--status-slate-text': '#526252',
          '--status-amber-bg': '#fff6df',
          '--status-amber-text': '#8a5c00',
          '--status-rose-bg': '#fff0f0',
          '--status-rose-text': '#b42318',
          '--s-new-bg': green[50],
          '--s-new-fg': green[700],
          '--s-new-dot': green[500],
          '--s-asg-bg': '#eef3fa',
          '--s-asg-fg': '#1c4980',
          '--s-asg-dot': '#1c4980',
          '--s-prog-bg': '#fbf3df',
          '--s-prog-fg': '#b07a16',
          '--s-prog-dot': '#b07a16',
          '--s-conv-bg': green[50],
          '--s-conv-fg': green[800],
          '--s-conv-dot': green[700],
          '--s-lost-bg': '#fbeaea',
          '--s-lost-fg': '#a23a3a',
          '--s-lost-dot': '#a23a3a',
          '--radius-sm': '4px',
          '--radius-md': '8px',
          '--radius-pill': '9999px',
          '--ink': green[900],
          '--muted': '#526252',
          '--line-2': '#cfe1cf'
        },
        body: {
          backgroundColor: '#f8fcf8',
          color: green[900]
        },
        '::selection': {
          backgroundColor: green[100]
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 32,
          borderRadius: 8,
          paddingLeft: 11,
          paddingRight: 11,
          boxShadow: 'none'
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 10px 20px rgba(45, 106, 45, 0.12)'
          }
        },
        containedPrimary: {
          color: '#ffffff'
        },
        outlined: {
          borderColor: '#9fba9f',
          color: green[600],
          backgroundColor: '#ffffff'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #e0ede0',
          boxShadow: 'none',
          backgroundImage: 'none',
          borderRadius: 8
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        },
        outlined: {
          borderColor: '#e0ede0'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 750
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: green[600],
          height: 3,
          borderRadius: 999
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          letterSpacing: 0,
          fontWeight: 800,
          minHeight: 38
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#ffffff',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#9fba9f'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: green[600]
          }
        },
        input: {
          paddingTop: 9,
          paddingBottom: 9
        },
        notchedOutline: {
          borderColor: '#cfe1cf'
        }
      }
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: green[600],
            '& + .MuiSwitch-track': {
              backgroundColor: green[500]
            }
          }
        }
      }
    }
  }
});
