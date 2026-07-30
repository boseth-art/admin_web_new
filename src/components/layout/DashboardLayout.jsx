import { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton,
  ListItemIcon, ListItemText, IconButton, Avatar, Tooltip,
  Divider, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Button, CircularProgress, Chip,
  Select, MenuItem, FormControl, InputLabel, TextField
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import TuneIcon from '@mui/icons-material/Tune';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import LockPersonIcon from '@mui/icons-material/LockPerson';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import GavelIcon from '@mui/icons-material/Gavel';
import { useAuth } from '../../App';
import NotificationsPanel from './NotificationsPanel';
import { db } from '../../data/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { encryptPasswordWithAnswers, hashEmailForDocId } from '../../security/recoveryCrypto';

const SECURITY_QUESTIONS_PRESETS = [
  { id: 'q1', question: 'What was your childhood nickname?' },
  { id: 'q2', question: 'In what city did you meet your spouse/significant other?' },
  { id: 'q3', question: 'What is the name of your favorite childhood friend?' },
  { id: 'q4', question: 'What street did you live on in third grade?' },
  { id: 'q5', question: 'What is the middle name of your youngest child?' },
];

const DRAWER_WIDTH = 260;

const navItems = [
  { label: 'Dashboard',    icon: <DashboardIcon />,    path: '/dashboard',    section: 'main' },
  { label: 'Users',        icon: <PeopleIcon />,        path: '/users',        badge: '2.4K', section: 'main' },
  { label: 'Transactions', icon: <ReceiptLongIcon />,   path: '/transactions', section: 'main' },
  { label: 'Analytics',   icon: <BarChartIcon />,      path: '/analytics',    section: 'main' },
  { label: 'Settings',    icon: <SettingsIcon />,      path: '/settings',     section: 'manage' },
];

// Super admin exclusive nav items
const superAdminNavItems = [
  { label: 'Control Panel',      icon: <TuneIcon />,                  path: '/super-admin' },
  { label: 'Admin Management',   icon: <SupervisorAccountIcon />,      path: '/super-admin/admins' },
  { label: 'Security Center',    icon: <SecurityIcon />,               path: '/super-admin/security' },
  { label: 'Database Inspector', icon: <StorageIcon />,                path: '/super-admin/database' },
  { label: 'Bulk Operations',    icon: <GroupWorkIcon />,              path: '/super-admin/bulk' },
  { label: 'Permissions',        icon: <LockPersonIcon />,             path: '/super-admin/permissions' },
  { label: 'System Health',      icon: <MonitorHeartIcon />,           path: '/super-admin/health' },
  { label: 'App Config',         icon: <PhoneAndroidIcon />,           path: '/super-admin/config' },
  { label: 'Impersonate User',   icon: <ManageAccountsIcon />,         path: '/super-admin/impersonate' },
  { label: 'Compliance',         icon: <GavelIcon />,                  path: '/super-admin/compliance' },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Security Questions Setup State
  const [setupOpen, setSetupOpen] = useState(user && user.role === 'admin' && !user.securityQuestions);
  const [selectedQs, setSelectedQs] = useState(['', '', '']);
  const [answers, setAnswers] = useState(['', '', '']);
  const [currentPassword, setCurrentPassword] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');

  const handleSetupSubmit = async () => {
    if (selectedQs.includes('') || answers.some(a => !a.trim())) {
      setSetupError('Please select and answer all 3 questions.');
      return;
    }
    if (!currentPassword) {
      setSetupError('Please enter your current password so we can securely encrypt it.');
      return;
    }
    const uniqueQs = new Set(selectedQs);
    if (uniqueQs.size !== 3) {
      setSetupError('Please select 3 different questions.');
      return;
    }
    setSetupError('');
    setSetupLoading(true);

    try {
      // Encrypt the provided password using the answers
      const { salt, iv, ciphertext } = await encryptPasswordWithAnswers(currentPassword, answers);
      
      // Hash the email to use as the document ID
      const emailHash = await hashEmailForDocId(user.email);

      // Save encrypted bundle to public admin_recovery collection
      await setDoc(doc(db, 'admin_recovery', emailHash), {
        questions: selectedQs.map(qId => SECURITY_QUESTIONS_PRESETS.find(q => q.id === qId).question),
        salt,
        iv,
        ciphertext,
        updatedAt: new Date().toISOString()
      });

      // Mark the user as having security questions set
      await updateDoc(doc(db, 'users', user.uid), { securityQuestions: true });

      setSetupOpen(false);
    } catch (err) {
      console.error(err);
      setSetupError('Failed to save security questions.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleLogoutRequest = () => setLogoutDialogOpen(true);

  const handleLogoutConfirm = async () => {
    setLogoutLoading(true);
    try {
      // logout() in AuthProvider handles signOut + session clearing + redirect
      await logout('manual');
    } finally {
      setLogoutLoading(false);
      setLogoutDialogOpen(false);
    }
  };

  const handleLogoutCancel = () => {
    if (!logoutLoading) setLogoutDialogOpen(false);
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand */}
      <Box sx={{ px: 3, py: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box component="img" src="/images/logo.png" alt="FinGuard" sx={{ width: 38, height: 38, objectFit: 'contain' }} />
        <Typography fontWeight={800} fontSize="1.15rem" sx={{ color: '#F0F6FF', letterSpacing: '-0.01em' }}>
          FinGuard
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgba(45,212,191,0.08)', mx: 2, mb: 1 }} />

      {/* Nav */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
        <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, letterSpacing: '0.1em', px: 2, display: 'block', mb: 1, textTransform: 'uppercase' }}>
          Main
        </Typography>
        <List disablePadding>
          {navItems.filter(n => n.section === 'main').map(({ label, icon, path, badge }) => {
            const active = location.pathname === path;
            return (
              <ListItemButton
                key={path}
                selected={active}
                onClick={() => { navigate(path); setMobileOpen(false); }}
                sx={{ borderRadius: 2, mb: 0.5, pl: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: active ? '#2DD4BF' : '#475569' }}>{icon}</ListItemIcon>
                <ListItemText
                  primary={label}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: active ? 600 : 400, color: active ? '#2DD4BF' : '#94A3B8' }}
                />
                {badge && (
                  <Typography sx={{ fontSize: '0.7rem', color: active ? '#2DD4BF' : '#475569', background: active ? 'rgba(45,212,191,0.1)' : 'rgba(71,85,105,0.3)', px: 1, borderRadius: 1, fontWeight: 600 }}>
                    {badge}
                  </Typography>
                )}
              </ListItemButton>
            );
          })}
        </List>

        <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, letterSpacing: '0.1em', px: 2, display: 'block', mt: 2, mb: 1, textTransform: 'uppercase' }}>
          Manage
        </Typography>
        <List disablePadding>
          {navItems.filter(n => n.section === 'manage').map(({ label, icon, path }) => {
            const active = location.pathname === path;
            return (
              <ListItemButton key={path} selected={active} onClick={() => { navigate(path); setMobileOpen(false); }} sx={{ borderRadius: 2, mb: 0.5, pl: 2 }}>
                <ListItemIcon sx={{ minWidth: 36, color: active ? '#2DD4BF' : '#475569' }}>{icon}</ListItemIcon>
                <ListItemText primary={label} primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: active ? 600 : 400, color: active ? '#2DD4BF' : '#94A3B8' }} />
              </ListItemButton>
            );
          })}
          <ListItemButton component={Link} to="/about" target="_blank" sx={{ borderRadius: 2, mb: 0.5, pl: 2 }}>
            <ListItemIcon sx={{ minWidth: 36, color: '#475569' }}><InfoOutlinedIcon /></ListItemIcon>
            <ListItemText primary="About App" primaryTypographyProps={{ fontSize: '0.875rem', color: '#94A3B8' }} />
          </ListItemButton>
        </List>
        {/* Super Admin section — only visible to superadmin */}
        {user?.role === 'superadmin' && (
          <>
            <Typography variant="caption" sx={{ color: '#92400E', fontWeight: 700, letterSpacing: '0.1em', px: 2, display: 'block', mt: 2, mb: 1, textTransform: 'uppercase' }}>
              ⚡ Super Admin
            </Typography>
            <List disablePadding>
              {superAdminNavItems.map(({ label, icon, path }) => {
                const active = location.pathname === path || location.pathname.startsWith(path + '/');
                return (
                  <ListItemButton
                    key={path}
                    selected={active}
                    onClick={() => { navigate(path); setMobileOpen(false); }}
                    sx={{
                      borderRadius: 2, mb: 0.5, pl: 2,
                      '&.Mui-selected': {
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.08))',
                        borderLeft: '3px solid #F59E0B',
                        '& .MuiListItemIcon-root': { color: '#F59E0B' },
                        '& .MuiListItemText-primary': { color: '#F59E0B', fontWeight: 600 },
                        '&:hover': { background: 'rgba(245,158,11,0.22)' },
                      },
                      '&:hover': { background: 'rgba(245,158,11,0.08)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: active ? '#F59E0B' : '#78716C' }}>{icon}</ListItemIcon>
                    <ListItemText
                      primary={label}
                      primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: active ? 600 : 400, color: active ? '#F59E0B' : '#A8A29E' }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(45,212,191,0.08)', mx: 2 }} />
      {/* Admin / Super Admin profile */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{
          width: 36, height: 36,
          background: user?.role === 'superadmin'
            ? 'linear-gradient(135deg,#F59E0B,#D97706)'
            : 'linear-gradient(135deg,#2DD4BF,#0D9488)',
          fontSize: '0.85rem', fontWeight: 700,
        }}>
          {user?.name?.[0] || 'A'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ color: '#F0F6FF', fontSize: '0.85rem', fontWeight: 600 }} noWrap>{user?.name || 'Admin'}</Typography>
            {user?.role === 'superadmin' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <AdminPanelSettingsIcon sx={{ fontSize: 14, color: '#F59E0B' }} />
              </Box>
            )}
          </Box>
          <Typography sx={{ color: '#475569', fontSize: '0.72rem' }} noWrap>{user?.email}</Typography>
        </Box>
        <Tooltip title="Sign Out">
          <IconButton
            size="small"
            id="logoutBtn"
            onClick={handleLogoutRequest}
            aria-label="Sign out"
            sx={{ color: '#475569', '&:hover': { color: '#F87171', background: 'rgba(248,113,113,0.08)' }, borderRadius: 1.5, p: 0.8, transition: 'all 0.2s' }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <>
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop Drawer */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid rgba(45,212,191,0.08)' },
        }}
        ModalProps={{ keepMounted: true }}
      >
        {drawerContent}
      </Drawer>

      {/* Main */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* AppBar */}
        <AppBar position="sticky" elevation={0} sx={{ zIndex: 50 }}>
          <Toolbar sx={{ gap: 2, minHeight: '64px !important' }}>
            {isMobile && (
              <IconButton onClick={() => setMobileOpen(true)} sx={{ color: '#94A3B8' }}>
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ flex: 1 }} />
            <NotificationsPanel />
        <Avatar sx={{
            width: 34, height: 34,
            background: user?.role === 'superadmin'
              ? 'linear-gradient(135deg,#F59E0B,#D97706)'
              : 'linear-gradient(135deg,#2DD4BF,#0D9488)',
            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
          }}>
            {user?.name?.[0] || 'A'}
          </Avatar>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box component="main" sx={{ flex: 1, p: { xs: 2, sm: 3, md: 4 }, overflowY: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>

      {/* ── Logout Confirmation Dialog ─────────────────────────────────── */}
      <Dialog
        open={logoutDialogOpen}
        onClose={handleLogoutCancel}
        PaperProps={{
          sx: {
            background: 'rgba(13,27,42,0.97)',
            border: '1px solid rgba(45,212,191,0.2)',
            backdropFilter: 'blur(24px)',
            borderRadius: 4,
            minWidth: 360,
          },
        }}
        BackdropProps={{
          sx: { backdropFilter: 'blur(4px)', background: 'rgba(7,13,24,0.6)' },
        }}
      >
        <DialogTitle sx={{ color: '#F0F6FF', fontWeight: 700, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShieldOutlinedIcon sx={{ color: '#2DD4BF' }} />
            Sign Out
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#94A3B8', lineHeight: 1.7 }}>
            Are you sure you want to sign out of the FinGuard Admin Portal?
            Your session will be ended and all unsaved changes will be lost.
          </DialogContentText>
          {user && (
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, background: 'rgba(45,212,191,0.05)', border: '1px solid rgba(45,212,191,0.1)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ width: 30, height: 30, background: 'linear-gradient(135deg,#2DD4BF,#0D9488)', fontSize: '0.75rem', fontWeight: 700 }}>
                {user.name?.[0] || 'A'}
              </Avatar>
              <Box>
                <Typography sx={{ color: '#F0F6FF', fontSize: '0.85rem', fontWeight: 600 }}>{user.name}</Typography>
                <Typography sx={{ color: '#475569', fontSize: '0.75rem' }}>{user.email}</Typography>
              </Box>
              <Chip
                label={user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                size="small"
                sx={{
                  ml: 'auto',
                  background: user?.role === 'superadmin' ? 'rgba(245,158,11,0.15)' : 'rgba(45,212,191,0.1)',
                  color: user?.role === 'superadmin' ? '#F59E0B' : '#2DD4BF',
                  border: `1px solid ${user?.role === 'superadmin' ? 'rgba(245,158,11,0.3)' : 'rgba(45,212,191,0.2)'}`,
                  fontWeight: 600, fontSize: '0.7rem',
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>
          <Button
            onClick={handleLogoutCancel}
            disabled={logoutLoading}
            id="logoutCancelBtn"
            sx={{ color: '#64748B', '&:hover': { color: '#94A3B8', background: 'rgba(255,255,255,0.04)' }, borderRadius: 2, px: 2.5 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLogoutConfirm}
            disabled={logoutLoading}
            id="logoutConfirmBtn"
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #F87171, #EF4444)',
              borderRadius: 2,
              px: 3,
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(248,113,113,0.3)',
              '&:hover': { background: 'linear-gradient(135deg, #FCA5A5, #F87171)', transform: 'translateY(-1px)' },
              transition: 'all 0.2s',
              minWidth: 110,
            }}
          >
            {logoutLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Sign Out'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Security Questions Setup Modal ─────────────────────────────── */}
      <Dialog
        open={setupOpen}
        disableEscapeKeyDown
        PaperProps={{
          sx: {
            background: 'rgba(13,27,42,0.97)',
            border: '1px solid rgba(45,212,191,0.2)',
            backdropFilter: 'blur(24px)',
            borderRadius: 4,
            minWidth: { xs: '90vw', sm: 500 },
          },
        }}
        BackdropProps={{
          sx: { backdropFilter: 'blur(4px)', background: 'rgba(7,13,24,0.6)' },
        }}
      >
        <DialogTitle sx={{ color: '#F0F6FF', fontWeight: 700, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShieldOutlinedIcon sx={{ color: '#2DD4BF' }} />
            Security Questions Setup
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#94A3B8', mb: 3 }}>
            To ensure account recovery is secure, please set up your security questions. You will need these to recover your admin account if you forget your password.
          </DialogContentText>
          
          {setupError && (
            <Box sx={{ p: 1.5, mb: 2, borderRadius: 2, background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
              {setupError}
            </Box>
          )}

          {[0, 1, 2].map((idx) => (
            <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#94A3B8' }}>Question {idx + 1}</InputLabel>
                <Select
                  value={selectedQs[idx]}
                  label={`Question ${idx + 1}`}
                  onChange={(e) => {
                    const newQs = [...selectedQs];
                    newQs[idx] = e.target.value;
                    setSelectedQs(newQs);
                  }}
                  sx={{ color: '#F0F6FF', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  {SECURITY_QUESTIONS_PRESETS.map((q) => (
                    <MenuItem key={q.id} value={q.id}>{q.question}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                fullWidth
                label="Answer"
                value={answers[idx]}
                onChange={(e) => {
                  const newAnswers = [...answers];
                  newAnswers[idx] = e.target.value;
                  setAnswers(newAnswers);
                }}
                sx={{ '& .MuiOutlinedInput-root': { color: '#F0F6FF', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }, '& .MuiInputLabel-root': { color: '#94A3B8' } }}
              />
            </Box>
          ))}
          <Box sx={{ mt: 1, mb: 1 }}>
            <Typography sx={{ color: '#94A3B8', fontSize: '0.85rem', mb: 1 }}>
              Enter your current password to encrypt and securely store it:
            </Typography>
            <TextField
              size="small"
              fullWidth
              type="password"
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              sx={{ 
                '& .MuiOutlinedInput-root': { 
                  color: '#F0F6FF', 
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } 
                }, 
                '& .MuiInputLabel-root': { color: '#94A3B8' },
                '& input:-webkit-autofill': {
                  WebkitBoxShadow: '0 0 0 1000px #0D1B2A inset',
                  WebkitTextFillColor: '#F0F6FF',
                  caretColor: '#F0F6FF',
                  borderRadius: 'inherit'
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setSetupOpen(false)}
            disabled={setupLoading}
            sx={{ color: '#94A3B8' }}
          >
            Skip
          </Button>
          <Button
            onClick={handleSetupSubmit}
            disabled={setupLoading}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #2DD4BF, #0D9488)',
              borderRadius: 2,
              px: 3,
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(45,212,191,0.2)',
              minWidth: 120,
            }}
          >
            {setupLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Save Questions'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
