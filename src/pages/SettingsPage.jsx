import {
  Box, Card, CardContent, Typography, Grid, TextField, Button,
  Switch, FormControlLabel, Divider, Avatar, Chip,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

export default function SettingsPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Settings</Typography>
        <Typography sx={{ color: '#64748B', mt: 0.5 }}>Manage admin preferences and system configuration</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Profile */}
        <Grid item xs={12} md={4}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, background: 'linear-gradient(135deg,#2DD4BF,#6366F1)', fontSize: '1.8rem', fontWeight: 800 }}>A</Avatar>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF' }}>Super Admin</Typography>
              <Typography sx={{ color: '#64748B', fontSize: '0.85rem', mb: 2 }}>admin@finguard.com</Typography>
              <Chip label="Administrator" size="small" sx={{ background: 'rgba(45,212,191,0.1)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.2)', fontWeight: 600 }} />
              <Box sx={{ mt: 3 }}>
                <Button variant="outlined" size="small" fullWidth sx={{ borderColor: 'rgba(45,212,191,0.25)', color: '#2DD4BF', '&:hover': { borderColor: '#2DD4BF', background: 'rgba(45,212,191,0.05)' } }}>
                  Change Avatar
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Account Settings */}
        <Grid item xs={12} md={8}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 3 }}>Account Settings</Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Display Name" defaultValue="Super Admin" size="small" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Email Address" defaultValue="admin@finguard.com" size="small" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Current Password" type="password" placeholder="••••••••" size="small" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="New Password" type="password" placeholder="••••••••" size="small" />
                </Grid>
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" color="primary" startIcon={<SaveIcon />}>Save Changes</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Notifications */}
        <Grid item xs={12} md={6}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 3 }}>Notification Preferences</Typography>
              {[
                { label: 'New user registrations', sub: 'Alert when a new user signs up', def: true },
                { label: 'Large transactions', sub: 'Flag transactions over $5,000', def: true },
                { label: 'Failed logins', sub: 'Suspicious login attempts', def: true },
                { label: 'System backup alerts', sub: 'Backup completion notifications', def: false },
                { label: 'Weekly digest', sub: 'Summary report every Monday', def: false },
              ].map(({ label, sub, def }) => (
                <Box key={label}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
                    <Box>
                      <Typography sx={{ color: '#F0F6FF', fontSize: '0.88rem', fontWeight: 500 }}>{label}</Typography>
                      <Typography sx={{ color: '#475569', fontSize: '0.75rem' }}>{sub}</Typography>
                    </Box>
                    <Switch defaultChecked={def} sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#2DD4BF' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { background: '#2DD4BF' } }} />
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
                { label: 'Maintenance Mode', sub: 'Disable user access temporarily', def: false },
                { label: 'Auto-backup', sub: 'Daily automated database backup', def: true },
                { label: 'Rate Limiting', sub: 'Limit API requests per user', def: true },
                { label: 'Audit Logging', sub: 'Log all admin actions', def: true },
                { label: 'Beta Features', sub: 'Enable experimental features', def: false },
              ].map(({ label, sub, def }) => (
                <Box key={label}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
                    <Box>
                      <Typography sx={{ color: '#F0F6FF', fontSize: '0.88rem', fontWeight: 500 }}>{label}</Typography>
                      <Typography sx={{ color: '#475569', fontSize: '0.75rem' }}>{sub}</Typography>
                    </Box>
                    <Switch defaultChecked={def} sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#2DD4BF' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { background: '#2DD4BF' } }} />
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(45,212,191,0.06)' }} />
                </Box>
              ))}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" color="primary" startIcon={<SaveIcon />}>Apply Config</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
