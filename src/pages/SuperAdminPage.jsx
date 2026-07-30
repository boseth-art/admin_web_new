/**
 * SuperAdminPage.jsx
 * ───────────────────
 * The main Super Admin Control Panel.
 * Gold/amber design identity distinguishes it from the regular teal admin panel.
 *
 * Sections:
 *  1. KPI Stats row  (total users, admins, transactions, revenue)
 *  2. Feature Flags  (Firestore-backed toggles)
 *  3. Audit Log      (real-time feed of admin actions)
 *  4. Broadcast Notification sender
 *  5. Data Export    (users & transactions as CSV)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Button,
  Switch, Divider, CircularProgress, Alert, TextField,
  Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Tooltip, FormControl, InputLabel, Select,
  MenuItem, LinearProgress, Avatar,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TuneIcon from '@mui/icons-material/Tune';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useAuth } from '../App';
import {
  fetchSystemStats,
  fetchFeatureFlags,
  updateFeatureFlags,
  subscribeAuditLog,
  writeAuditLog,
} from '../data/adminService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../data/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ── Gold palette constants ───────────────────────────────────────────────────
const GOLD   = '#F59E0B';
const GOLD_L = '#FCD34D';
const GOLD_D = '#D97706';
const GOLD_BG   = 'rgba(245,158,11,0.08)';
const GOLD_BRD  = 'rgba(245,158,11,0.2)';

// ── Gradient section heading ──────────────────────────────────────────────────
function SectionHeading({ icon, title, subtitle, action }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ p: 1, borderRadius: 2, background: GOLD_BG, border: `1px solid ${GOLD_BRD}`, color: GOLD, display: 'flex' }}>
          {icon}
        </Box>
        <Box>
          <Typography fontWeight={700} sx={{ color: '#F0F6FF', lineHeight: 1.2 }}>{title}</Typography>
          {subtitle && <Typography sx={{ color: '#78716C', fontSize: '0.78rem' }}>{subtitle}</Typography>}
        </Box>
      </Box>
      {action}
    </Box>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = GOLD }) {
  return (
    <Card elevation={0} sx={{
      background: 'rgba(17,30,46,0.9)',
      border: `1px solid ${GOLD_BRD}`,
      backdropFilter: 'blur(20px)',
      transition: 'all 0.3s ease',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 12px 40px rgba(245,158,11,0.15)`, borderColor: GOLD },
    }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 2, background: `rgba(245,158,11,0.1)`, color, display: 'flex' }}>{icon}</Box>
          <Typography sx={{ color: '#78716C', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</Typography>
        </Box>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>{value}</Typography>
        {sub && <Typography sx={{ color: '#78716C', fontSize: '0.78rem', mt: 0.5 }}>{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

// ── Feature Flag Row ───────────────────────────────────────────────────────────
function FlagRow({ flagKey, label, sub, value, onChange, loading }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
        <Box>
          <Typography sx={{ color: '#F0F6FF', fontSize: '0.88rem', fontWeight: 500 }}>{label}</Typography>
          <Typography sx={{ color: '#78716C', fontSize: '0.75rem' }}>{sub}</Typography>
        </Box>
        <Switch
          checked={!!value}
          disabled={loading}
          onChange={(e) => onChange(flagKey, e.target.checked)}
          sx={{
            '& .MuiSwitch-switchBase.Mui-checked': { color: GOLD },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { background: GOLD },
          }}
        />
      </Box>
      <Divider sx={{ borderColor: 'rgba(245,158,11,0.08)' }} />
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const functions  = getFunctions();

  // Stats
  const [stats, setStats]         = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Feature flags
  const [flags, setFlags]         = useState({});
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [flagSaving, setFlagSaving] = useState(false);

  // Audit log
  const [auditLog, setAuditLog]   = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);

  // Broadcast notification
  const [bcastTitle, setBcastTitle]   = useState('');
  const [bcastBody, setBcastBody]     = useState('');
  const [bcastType, setBcastType]     = useState('system');
  const [bcastLoading, setBcastLoading] = useState(false);
  const [bcastMsg, setBcastMsg]       = useState({ type: '', text: '' });

  // Export
  const [exportLoading, setExportLoading] = useState('');

  // ── Load stats ───────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await fetchSystemStats();
      setStats(s);
    } catch (err) {
      console.error('Stats error:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Load feature flags ────────────────────────────────────────────────────
  const loadFlags = useCallback(async () => {
    setFlagsLoading(true);
    try {
      const f = await fetchFeatureFlags();
      setFlags(f);
    } catch (err) {
      console.error('Flags error:', err);
    } finally {
      setFlagsLoading(false);
    }
  }, []);

  // ── Subscribe to audit log ────────────────────────────────────────────────
  useEffect(() => {
    setAuditLoading(true);
    const unsub = subscribeAuditLog((entries) => {
      setAuditLog(entries);
      setAuditLoading(false);
    }, 30);
    return unsub;
  }, []);

  useEffect(() => {
    loadStats();
    loadFlags();
  }, [loadStats, loadFlags]);

  // ── Toggle a feature flag ─────────────────────────────────────────────────
  const handleFlagToggle = async (key, value) => {
    setFlagSaving(true);
    try {
      setFlags(prev => ({ ...prev, [key]: value }));
      await updateFeatureFlags({ [key]: value }, user.uid);
      await writeAuditLog({
        action: `FEATURE_FLAG_${key.toUpperCase()}_${value ? 'ENABLED' : 'DISABLED'}`,
        actorUid: user.uid, actorEmail: user.email,
        details: { flag: key, value },
      });
    } catch (err) {
      console.error('Flag toggle error:', err);
      setFlags(prev => ({ ...prev, [key]: !value })); // rollback
    } finally {
      setFlagSaving(false);
    }
  };

  // ── Send broadcast notification ───────────────────────────────────────────
  const handleBroadcast = async () => {
    if (!bcastTitle.trim() || !bcastBody.trim()) {
      setBcastMsg({ type: 'error', text: 'Title and body are required.' });
      return;
    }
    setBcastLoading(true);
    setBcastMsg({ type: '', text: '' });
    try {
      const fn = httpsCallable(functions, 'createAdminNotification');
      await fn({ title: bcastTitle, body: bcastBody, type: bcastType });
      await writeAuditLog({
        action: 'BROADCAST_NOTIFICATION',
        actorUid: user.uid, actorEmail: user.email,
        details: { title: bcastTitle, type: bcastType },
      });
      setBcastMsg({ type: 'success', text: 'Broadcast sent to all admins successfully.' });
      setBcastTitle('');
      setBcastBody('');
    } catch (err) {
      setBcastMsg({ type: 'error', text: err.message || 'Failed to send broadcast.' });
    } finally {
      setBcastLoading(false);
    }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportCSV = async (collectionName) => {
    setExportLoading(collectionName);
    try {
      const snap = await getDocs(collection(db, collectionName));
      const rows = snap.docs.map(d => d.data());
      if (rows.length === 0) return;
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(','),
        ...rows.map(r =>
          headers.map(h => {
            const v = r[h];
            const str = v === null || v === undefined ? '' : String(v);
            return `"${str.replace(/"/g, '""')}"`;
          }).join(',')
        ),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${collectionName}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      await writeAuditLog({
        action: `DATA_EXPORT_${collectionName.toUpperCase()}`,
        actorUid: user.uid, actorEmail: user.email,
        details: { records: rows.length },
      });
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportLoading('');
    }
  };

  // ── Audit log action label colours ────────────────────────────────────────
  const auditColor = (action = '') => {
    if (action.includes('DELETE') || action.includes('REVOKE'))  return '#F87171';
    if (action.includes('CREATE') || action.includes('ENABLED'))  return '#34D399';
    if (action.includes('UPDATE') || action.includes('BROADCAST')) return GOLD;
    if (action.includes('DISABLED') || action.includes('EXPORT'))  return '#94A3B8';
    return '#94A3B8';
  };

  const formatTs = (ts) => {
    if (!ts) return '—';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  return (
    <Box>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <Box sx={{
        mb: 4, p: 3, borderRadius: 3,
        background: `linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(13,27,42,0.6) 100%)`,
        border: `1px solid ${GOLD_BRD}`,
        backdropFilter: 'blur(20px)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative glow */}
        <Box sx={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ p: 1.5, borderRadius: 3, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_D})`, display: 'flex', boxShadow: `0 8px 24px rgba(245,158,11,0.4)` }}>
            <AdminPanelSettingsIcon sx={{ color: '#0D1B2A', fontSize: 28 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>
                Super Admin Control Panel
              </Typography>
              <Chip
                icon={<VerifiedUserIcon sx={{ fontSize: 14 }} />}
                label="SUPERADMIN"
                size="small"
                sx={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_D})`, color: '#0D1B2A', fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.1em' }}
              />
            </Box>
            <Typography sx={{ color: '#78716C', mt: 0.5 }}>
              Developer-level access · Logged in as <strong style={{ color: GOLD }}>{user?.email}</strong>
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<SupervisorAccountIcon />}
              onClick={() => navigate('/super-admin/admins')}
              sx={{ borderColor: GOLD_BRD, color: GOLD, '&:hover': { borderColor: GOLD, background: GOLD_BG } }}
            >
              Manage Admins
            </Button>
            <Tooltip title="Refresh stats">
              <IconButton onClick={loadStats} sx={{ color: GOLD, border: `1px solid ${GOLD_BRD}`, borderRadius: 2 }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* ── KPI Stats Row ────────────────────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {[
          { icon: <PeopleAltIcon />,         label: 'Total Users',    value: statsLoading ? '—' : (stats?.totalUsers ?? 0),    sub: `${statsLoading ? '—' : (stats?.activeUsers ?? 0)} active` },
          { icon: <SupervisorAccountIcon />,  label: 'Admin Accounts', value: statsLoading ? '—' : (stats?.totalAdmins ?? 0),   sub: 'Excluding super admin' },
          { icon: <ReceiptLongIcon />,        label: 'Transactions',   value: statsLoading ? '—' : (stats?.totalTxns ?? 0),     sub: 'All time' },
          { icon: <AttachMoneyIcon />,        label: 'Total Balance',  value: statsLoading ? '—' : `Rs. ${((stats?.totalRevenue ?? 0)).toLocaleString()}`, sub: 'Across all users' },
        ].map(s => (
          <Grid item xs={12} sm={6} md={3} key={s.label}>
            <StatCard {...s} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* ── Feature Flags ──────────────────────────────────────────────── */}
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ background: 'rgba(17,30,46,0.9)', border: `1px solid ${GOLD_BRD}`, backdropFilter: 'blur(20px)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeading
                icon={<TuneIcon fontSize="small" />}
                title="Feature Flags"
                subtitle="Live Firestore-backed — changes apply instantly"
              />
              {flagsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress sx={{ color: GOLD }} size={28} />
                </Box>
              ) : (
                <Box>
                  {flagSaving && <LinearProgress sx={{ mb: 2, borderRadius: 2, '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${GOLD}, ${GOLD_D})` } }} />}
                  {[
                    { key: 'maintenanceMode', label: 'Maintenance Mode',  sub: 'Disables user access — mobile app shows downtime screen' },
                    { key: 'rateLimiting',    label: 'Rate Limiting',      sub: 'Throttle API requests per user per minute' },
                    { key: 'auditLogging',    label: 'Audit Logging',      sub: 'Log all admin actions to Firestore auditLog collection' },
                    { key: 'betaFeatures',    label: 'Beta Features',      sub: 'Enable experimental UI features for testing' },
                    { key: 'autoBackup',      label: 'Auto Backup',        sub: 'Daily automated export of critical Firestore data' },
                  ].map(f => (
                    <FlagRow
                      key={f.key}
                      flagKey={f.key}
                      label={f.label}
                      sub={f.sub}
                      value={flags[f.key]}
                      onChange={handleFlagToggle}
                      loading={flagSaving}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Broadcast & Data Export ────────────────────────────────────── */}
        <Grid item xs={12} md={7}>
          <Grid container spacing={3} direction="column">
            {/* Broadcast */}
            <Grid item>
              <Card elevation={0} sx={{ background: 'rgba(17,30,46,0.9)', border: `1px solid ${GOLD_BRD}`, backdropFilter: 'blur(20px)' }}>
                <CardContent sx={{ p: 3 }}>
                  <SectionHeading
                    icon={<NotificationsActiveIcon fontSize="small" />}
                    title="Broadcast Notification"
                    subtitle="Sends a notification visible to all admins in the panel"
                  />
                  {bcastMsg.text && (
                    <Alert severity={bcastMsg.type || 'info'} onClose={() => setBcastMsg({ type: '', text: '' })} sx={{ mb: 2, borderRadius: 2 }}>
                      {bcastMsg.text}
                    </Alert>
                  )}
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={8}>
                      <TextField
                        fullWidth size="small" label="Notification Title"
                        value={bcastTitle} onChange={e => setBcastTitle(e.target.value)}
                        inputProps={{ maxLength: 150 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Type</InputLabel>
                        <Select value={bcastType} label="Type" onChange={e => setBcastType(e.target.value)}>
                          <MenuItem value="system">System</MenuItem>
                          <MenuItem value="alert">Alert</MenuItem>
                          <MenuItem value="report">Report</MenuItem>
                          <MenuItem value="user">User</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth size="small" label="Message Body" multiline rows={3}
                        value={bcastBody} onChange={e => setBcastBody(e.target.value)}
                        inputProps={{ maxLength: 1000 }}
                      />
                    </Grid>
                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        variant="contained"
                        startIcon={bcastLoading ? <CircularProgress size={16} sx={{ color: '#0D1B2A' }} /> : <NotificationsActiveIcon />}
                        onClick={handleBroadcast}
                        disabled={bcastLoading}
                        sx={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_D})`, color: '#0D1B2A', fontWeight: 700, boxShadow: `0 4px 16px rgba(245,158,11,0.3)`, '&:hover': { background: `linear-gradient(135deg, ${GOLD_L}, ${GOLD})`, transform: 'translateY(-1px)' } }}
                      >
                        {bcastLoading ? 'Sending…' : 'Send Broadcast'}
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Data Export */}
            <Grid item>
              <Card elevation={0} sx={{ background: 'rgba(17,30,46,0.9)', border: `1px solid ${GOLD_BRD}`, backdropFilter: 'blur(20px)' }}>
                <CardContent sx={{ p: 3 }}>
                  <SectionHeading
                    icon={<DownloadIcon fontSize="small" />}
                    title="Data Export"
                    subtitle="Download Firestore collections as CSV"
                  />
                  <Grid container spacing={2}>
                    {[
                      { key: 'users',        label: 'Export Users',        sub: 'All user profiles' },
                      { key: 'transactions', label: 'Export Transactions',  sub: 'All transaction records' },
                    ].map(({ key, label, sub }) => (
                      <Grid item xs={12} sm={6} key={key}>
                        <Box sx={{ p: 2, borderRadius: 2, background: GOLD_BG, border: `1px solid ${GOLD_BRD}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography sx={{ color: '#F0F6FF', fontSize: '0.88rem', fontWeight: 600 }}>{label}</Typography>
                            <Typography sx={{ color: '#78716C', fontSize: '0.75rem' }}>{sub}</Typography>
                          </Box>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={exportLoading === key ? <CircularProgress size={14} sx={{ color: GOLD }} /> : <DownloadIcon />}
                            onClick={() => exportCSV(key)}
                            disabled={!!exportLoading}
                            sx={{ borderColor: GOLD_BRD, color: GOLD, '&:hover': { borderColor: GOLD, background: GOLD_BG } }}
                          >
                            CSV
                          </Button>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* ── Audit Log ──────────────────────────────────────────────────── */}
        <Grid item xs={12}>
          <Card elevation={0} sx={{ background: 'rgba(17,30,46,0.9)', border: `1px solid ${GOLD_BRD}`, backdropFilter: 'blur(20px)' }}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeading
                icon={<VerifiedUserIcon fontSize="small" />}
                title="Audit Log"
                subtitle="Real-time stream of super admin actions"
                action={
                  <Button
                    variant="text"
                    endIcon={<OpenInNewIcon />}
                    onClick={() => navigate('/super-admin/admins')}
                    sx={{ color: GOLD, fontSize: '0.78rem' }}
                  >
                    Admin Management
                  </Button>
                }
              />
              {auditLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress sx={{ color: GOLD }} size={28} />
                </Box>
              ) : auditLog.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <WarningAmberIcon sx={{ color: '#78716C', fontSize: 36, mb: 1 }} />
                  <Typography sx={{ color: '#78716C' }}>No audit log entries yet.</Typography>
                  <Typography sx={{ color: '#4A5568', fontSize: '0.8rem' }}>Actions taken by super admin will appear here.</Typography>
                </Box>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['Action', 'Actor', 'Target', 'Details', 'Time'].map(h => (
                          <TableCell key={h} sx={{ color: '#78716C', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(245,158,11,0.05)' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditLog.map(entry => (
                        <TableRow key={entry.id} sx={{ '&:hover': { background: 'rgba(245,158,11,0.04)' } }}>
                          <TableCell>
                            <Chip
                              label={entry.action || '—'}
                              size="small"
                              sx={{ background: `${auditColor(entry.action)}15`, color: auditColor(entry.action), border: `1px solid ${auditColor(entry.action)}30`, fontWeight: 600, fontSize: '0.68rem', maxWidth: 220 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ color: '#F0F6FF', fontSize: '0.8rem' }}>{entry.actorEmail || '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ color: '#94A3B8', fontSize: '0.8rem' }}>{entry.targetEmail || '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ color: '#78716C', fontSize: '0.75rem' }}>
                              {entry.details ? Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ color: '#64748B', fontSize: '0.75rem' }}>{formatTs(entry.timestamp)}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
