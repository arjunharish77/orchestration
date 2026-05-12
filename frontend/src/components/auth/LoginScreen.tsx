'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import LoginIcon from '@mui/icons-material/Login';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { confirmPasswordReset, loginWithPassword, requestPasswordReset, storeAuthTokens, verifyLoginOtp } from '../../lib/auth';
const green = '#2d6a2d';
const bg = '#f8fcf8';
const line = '#e0ede0';
const panel = '#ffffff';

export function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'reset-request' | 'reset-confirm'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submitLogin = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'reset-request') {
        await requestPasswordReset(email);
        setNotice('Password reset email sent. Paste the reset token from email to continue.');
        setMode('reset-confirm');
        return;
      }

      if (mode === 'reset-confirm') {
        await confirmPasswordReset(email, resetToken, newPassword);
        setNotice('Password changed. You can sign in now.');
        setMode('login');
        setResetToken('');
        setNewPassword('');
        return;
      }

      const payload = awaitingOtp ? await verifyLoginOtp(email, otp) : await loginWithPassword(email, password);
      if (!awaitingOtp && payload.requiresEmailOtp) {
        setAwaitingOtp(true);
        setPassword('');
        return;
      }

      storeAuthTokens(payload);
      router.replace('/leads');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const resetToLogin = () => {
    setMode('login');
    setAwaitingOtp(false);
    setOtp('');
    setError(null);
  };

  const primaryDisabled = loading || !email
    || (mode === 'login' ? (awaitingOtp ? !otp : !password) : false)
    || (mode === 'reset-confirm' ? (!resetToken || !newPassword) : false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: bg, display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ width: 'min(440px, 100%)', border: `1px solid ${line}`, borderRadius: 1, overflow: 'hidden', bgcolor: panel }} elevation={0}>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${line}` }}>
          <Avatar sx={{ bgcolor: green, borderRadius: 1, width: 34, height: 34, fontWeight: 800 }}>U</Avatar>
          <Box>
            <Typography variant="h6">Unnatify</Typography>
            <Typography color="text.secondary" fontSize={12}>CRM workspace login</Typography>
          </Box>
        </Stack>
        <Stack spacing={1.25} sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LoginIcon sx={{ color: green }} />
            <Box>
              <Typography fontWeight={800}>{mode === 'login' ? 'Sign in' : mode === 'reset-request' ? 'Reset password' : 'Confirm reset'}</Typography>
              <Typography color="text.secondary" fontSize={12}>
                {mode === 'login' ? 'Use email and password. Email OTP is supported when enabled.' : 'Use the verified email and reset token sent by Resend.'}
              </Typography>
            </Box>
          </Stack>
          {error ? <Alert severity="error" sx={{ borderRadius: 1 }}>{error}</Alert> : null}
          {notice ? <Alert severity="success" sx={{ borderRadius: 1 }}>{notice}</Alert> : null}
          <TextField
            label="Email"
            size="small"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon fontSize="small" /></InputAdornment> }}
          />
          {mode === 'reset-confirm' ? (
            <>
              <TextField label="Reset token" size="small" value={resetToken} onChange={(event) => setResetToken(event.target.value)} autoComplete="one-time-code" />
              <TextField
                label="New password"
                size="small"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton edge="end" size="small" onClick={() => setShowPassword((current) => !current)}>
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </>
          ) : mode === 'login' && awaitingOtp ? (
            <TextField label="Verification code" size="small" value={otp} onChange={(event) => setOtp(event.target.value)} autoComplete="one-time-code" />
          ) : mode === 'login' ? (
            <TextField
              label="Password"
              size="small"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" size="small" onClick={() => setShowPassword((current) => !current)}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          ) : null}
          <Button variant="contained" onClick={submitLogin} disabled={primaryDisabled} sx={{ minHeight: 36, borderRadius: 1 }}>
            {loading ? 'Please wait...' : mode === 'login' ? (awaitingOtp ? 'Verify' : 'Sign in') : mode === 'reset-request' ? 'Send reset email' : 'Change password'}
          </Button>
          {mode === 'login' ? (
            <Button size="small" variant="text" onClick={() => { setMode('reset-request'); setError(null); setNotice(null); }}>
              Forgot password?
            </Button>
          ) : (
            <Button size="small" variant="text" onClick={resetToLogin}>
              Back to sign in
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
