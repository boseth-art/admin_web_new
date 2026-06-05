import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button,
  Switch, Divider, Avatar, Chip, Alert, CircularProgress,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { useAuth } from '../App';
import { auth } from '../data/firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

export default function SettingsPage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [pwdLoading, setPwdLoading]           = useState(false);
  const [pwdMsg, setPwdMsg]                   = useState({ type: '', text: '' });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPwdMsg({ type: 'error', text: 'Both fields are required.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (currentPassword === newPassword) {
      setPwdMsg({ type: 'error', text: 'New password must be different from the current one.' });
      return;
    }

    setPwdLoading(true);
    setPwdMsg({ type: '', text: '' });
    try {
      // Re-authenticate first (required by Firebase before sensitive operations)
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setPwdMsg({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPwdMsg({ type: 'error', text: 'Current password is incorrect.' });
      } else if (err.code === 'auth/weak-password') {
        setPwdMsg({ type: 'error', text: 'New password is too weak. Use at least 8 characters.' });
      } else {
        setPwdMsg({ type: 'error', text: 'Failed to update password. Please try again.' });
      }
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Settings</Typography>
        <Typography sx={{ color: '#64748B', mt: 0.5 }}>Manage admin preferences and system configuration</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid item xs={12} md={4}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, background: 'linear-gradient(135deg,#2DD4BF,#6366F1)', fontSize: '1.8rem', fontWeight: 800 }}>
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </Avatar>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF' }}>
                {user?.name || 'Admin'}
              </Typography>
              <Typography sx={{ color: '#64748B', fontSize: '0.85rem', mb: 2 }}>
                {user?.email || ''}
              </Typography>
              <Chip
                label="Administrator"
                size="small"
                sx={{ background: 'rgba(45,212,191,0.1)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.2)', fontWeight: 600 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Change Password */}
        <Grid item xs={12} md={8}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 0.5 }}>Change Password</Typography>
              <Typography sx={{ color: '#64748B', fontSize: '0.83rem', mb: 3 }}>
                Use a strong password with at least 8 characters, including numbers and symbols.
              </Typography>

              {pwdMsg.text && (
                <Alert
                  severity={pwdMsg.type}
                  onClose={() => setPwdMsg({ type: '', text: '' })}
                  sx={{ mb: 2.5, borderRadius: 2 }}
                >
                  {pwdMsg.text}
                </Alert>
              )}

              <Box component="form" onSubmit={handlePasswordChange} noValidate>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      value={user?.email || ''}
                      size="small"
                      disabled
                      InputProps={{ readOnly: true }}
                      helperText="Email cannot be changed here."
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Current Password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      size="small"
                      required
                      inputProps={{ maxLength: 128 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="New Password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      size="small"
                      required
                      inputProps={{ maxLength: 128 }}
                      helperText="Min. 8 characters"
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    startIcon={pwdLoading ? <CircularProgress size={16} sx={{ color: '#0D1B2A' }} /> : <SaveIcon />}
                    disabled={pwdLoading}
                  >
                    {pwdLoading ? 'Updating…' : 'Update Password'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Preferences */}
        <Grid item xs={12} md={6}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 3 }}>Notification Preferences</Typography>
              {[
                { label: 'New user registrations', sub: 'Alert when a new user signs up',     def: true  },
                { label: 'Large transactions',      sub: 'Flag transactions over $5,000',     def: true  },
                { label: 'Failed logins',           sub: 'Suspicious login attempts',         def: true  },
                { label: 'System backup alerts',    sub: 'Backup completion notifications',   def: false },
                { label: 'Weekly digest',           sub: 'Summary report every Monday',       def: false },
              ].map(({ label, sub, def }) => (
                <Box key={label}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
                    <Box>
                      <Typography sx={{ color: '#F0F6FF', fontSize: '0.88rem', fontWeight: 500 }}>{label}</Typography>
                      <Typography sx={{ color: '#475569', fontSize: '0.75rem' }}>{sub}</Typography>
                    </Box>
                    <Switch
                      defaultChecked={def}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#2DD4BF' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { background: '#2DD4BF' },
                      }}
                    />
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(45,212,191,0.06)' }} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* System Config */}
        <Grid item xs={12} md={6}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 3 }}>System Configuration</Typography>
              {[
                { label: 'Maintenance Mode', sub: 'Disable user access temporarily',   def: false },
                { label: 'Auto-backup',       sub: 'Daily automated database backup',  def: true  },
                { label: 'Rate Limiting',     sub: 'Limit API requests per user',      def: true  },
                { label: 'Audit Logging',     sub: 'Log all admin actions',            def: true  },
                { label: 'Beta Features',     sub: 'Enable experimental features',     def: false },
              ].map(({ label, sub, def }) => (
                <Box key={label}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
                    <Box>
                      <Typography sx={{ color: '#F0F6FF', fontSize: '0.88rem', fontWeight: 500 }}>{label}</Typography>
                      <Typography sx={{ color: '#475569', fontSize: '0.75rem' }}>{sub}</Typography>
                    </Box>
                    <Switch
                      defaultChecked={def}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#2DD4BF' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { background: '#2DD4BF' },
                      }}
                    />
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(45,212,191,0.06)' }} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
