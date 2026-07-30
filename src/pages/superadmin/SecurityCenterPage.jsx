import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import db from '../../data/firebase';
import { useAuth } from '../../App';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Paper
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import GppBadIcon from '@mui/icons-material/GppBad';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import LogoutIcon from '@mui/icons-material/Logout';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VisibilityIcon from '@mui/icons-material/Visibility';

export default function SecurityCenterPage() {
  const navigate = useNavigate();
  const { user } = useAuth() || {};

  const [securityLogs, setSecurityLogs] = useState([]);
  const [lockedAccounts, setLockedAccounts] = useState([]);
  const [suspiciousActivity, setSuspiciousActivity] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  
  const [error, setError] = useState(null);
  
  const [confirmLogout, setConfirmLogout] = useState(null);

  useEffect(() => {
    // Real-time securityLog
    const qLogs = query(collection(db, 'securityLog'), orderBy('timestamp', 'desc'), limit(50));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSecurityLogs(logs);
      setLockedAccounts(logs.filter(log => log.locked === true));
      setLoadingLogs(false);
    }, (err) => {
      console.error(err);
      setError('Failed to fetch security logs');
      setLoadingLogs(false);
    });

    // Real-time activeSessions
    const qSessions = query(collection(db, 'activeSessions'), orderBy('lastActivity', 'desc'));
    const unsubSessions = onSnapshot(qSessions, (snapshot) => {
      setActiveSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingSessions(false);
    }, (err) => {
      console.error(err);
      setError('Failed to fetch active sessions');
      setLoadingSessions(false);
    });

    // Fetch alerts
    const fetchAlerts = async () => {
      try {
        const qAlerts = query(collection(db, 'notifications'), where('type', '==', 'alert'), orderBy('createdAt', 'desc'), limit(50));
        const alertSnap = await getDocs(qAlerts);
        setSuspiciousActivity(alertSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
        setError('Failed to fetch alerts.');
      } finally {
        setLoadingAlerts(false);
      }
    };
    fetchAlerts();

    return () => {
      unsubLogs();
      unsubSessions();
    };
  }, []);

  const handleUnlock = async (logId) => {
    try {
      await updateDoc(doc(db, 'securityLog', logId), { locked: false });
    } catch (err) {
      console.error('Failed to unlock:', err);
      alert('Failed to unlock account.');
    }
  };

  const handleForceLogout = async () => {
    if (!confirmLogout) return;
    try {
      await updateDoc(doc(db, 'users', confirmLogout.uid), { forceLogout: true });
      setConfirmLogout(null);
    } catch (err) {
      console.error('Failed to force logout:', err);
      alert('Failed to force logout user.');
    }
  };

  const cardStyle = {
    background: 'rgba(17,30,46,0.9)',
    border: '1px solid rgba(245,158,11,0.2)',
    backdropFilter: 'blur(20px)',
    color: '#F0F6FF',
    height: '100%'
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', background: '#070D18' }}>
      {/* HEADER */}
      <Box sx={{ mb: 4, p: 3, borderRadius: 3, background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(13,27,42,0.5) 100%)', border: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(20px)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/super-admin')} sx={{ color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ p: 1.5, borderRadius: 3, background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', boxShadow: '0 6px 20px rgba(245,158,11,0.35)' }}>
            <SecurityIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Security Center</Typography>
            <Typography sx={{ color: '#78716C', mt: 0.5 }}>Monitor threats, failed logins, and active sessions</Typography>
          </Box>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Failed Login Tracker */}
        <Grid item xs={12} lg={6}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <GppBadIcon sx={{ color: '#F59E0B' }} />
                <Typography variant="h6">Failed Login Tracker</Typography>
              </Box>
              {loadingLogs ? <CircularProgress sx={{ color: '#F59E0B', display: 'block', m: 'auto' }} /> : (
                securityLogs.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 3, color: '#78716C' }}>
                    <SecurityIcon sx={{ fontSize: 40, opacity: 0.5, mb: 1 }} />
                    <Typography>No login failures recorded.</Typography>
                  </Box>
                ) : (
                  <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Email</TableCell>
                          <TableCell sx={{ color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Attempts</TableCell>
                          <TableCell sx={{ color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Time</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {securityLogs.slice(0, 10).map((log) => (
                          <TableRow key={log.id}>
                            <TableCell sx={{ color: '#F0F6FF', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>{log.email}</TableCell>
                            <TableCell sx={{ color: '#F0F6FF', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                              <Chip size="small" label={log.attemptCount} color={log.attemptCount >= 3 ? 'error' : 'default'} sx={{ backgroundColor: log.attemptCount >= 3 ? '#ef4444' : '#334155', color: '#fff' }} />
                            </TableCell>
                            <TableCell sx={{ color: '#F0F6FF', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                              {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Locked Accounts */}
        <Grid item xs={12} lg={6}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <LockIcon sx={{ color: '#F59E0B' }} />
                <Typography variant="h6">Locked Accounts</Typography>
              </Box>
              {loadingLogs ? <CircularProgress sx={{ color: '#F59E0B', display: 'block', m: 'auto' }} /> : (
                lockedAccounts.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 3, color: '#78716C' }}>
                    <LockOpenIcon sx={{ fontSize: 40, opacity: 0.5, mb: 1 }} />
                    <Typography>No locked accounts.</Typography>
                  </Box>
                ) : (
                  <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Email</TableCell>
                          <TableCell sx={{ color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Locked At</TableCell>
                          <TableCell sx={{ color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lockedAccounts.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell sx={{ color: '#F0F6FF', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>{account.email}</TableCell>
                            <TableCell sx={{ color: '#F0F6FF', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                              {account.lockedAt?.toDate ? account.lockedAt.toDate().toLocaleString() : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#F0F6FF', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                              <Button variant="outlined" size="small" onClick={() => handleUnlock(account.id)} sx={{ color: '#F59E0B', borderColor: '#F59E0B' }}>
                                Force Unlock
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Admin Session Tracker */}
        <Grid item xs={12} lg={6}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <VisibilityIcon sx={{ color: '#F59E0B' }} />
                <Typography variant="h6">Active Sessions</Typography>
              </Box>
              {loadingSessions ? <CircularProgress sx={{ color: '#F59E0B', display: 'block', m: 'auto' }} /> : (
                activeSessions.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 3, color: '#78716C' }}>
                    <PersonOffIcon sx={{ fontSize: 40, opacity: 0.5, mb: 1 }} />
                    <Typography>No active sessions found.</Typography>
                  </Box>
                ) : (
                  <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>User</TableCell>
                          <TableCell sx={{ color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Login Time</TableCell>
                          <TableCell sx={{ color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeSessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell sx={{ color: '#F0F6FF', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                              {session.name || session.email}
                              <Typography variant="caption" display="block" sx={{ color: '#78716C' }}>{session.uid}</Typography>
                            </TableCell>
                            <TableCell sx={{ color: '#F0F6FF', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                              {session.loginAt?.toDate ? session.loginAt.toDate().toLocaleString() : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#F0F6FF', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                              <IconButton onClick={() => setConfirmLogout(session)} sx={{ color: '#ef4444' }} size="small">
                                <LogoutIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Suspicious Activity Feed */}
        <Grid item xs={12} lg={6}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <WarningAmberIcon sx={{ color: '#F59E0B' }} />
                <Typography variant="h6">Suspicious Activity</Typography>
              </Box>
              {loadingAlerts ? <CircularProgress sx={{ color: '#F59E0B', display: 'block', m: 'auto' }} /> : (
                suspiciousActivity.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 3, color: '#78716C' }}>
                    <SecurityIcon sx={{ fontSize: 40, opacity: 0.5, mb: 1 }} />
                    <Typography>No suspicious activity alerts.</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {suspiciousActivity.map(alert => (
                      <Box key={alert.id} sx={{ p: 2, borderRadius: 2, background: 'rgba(245,158,11,0.05)', borderLeft: '4px solid #F59E0B' }}>
                        <Typography variant="subtitle2" sx={{ color: '#F0F6FF' }}>{alert.title || 'Security Alert'}</Typography>
                        <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>{alert.message}</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, alignItems: 'center' }}>
                          <Chip size="small" label="Alert" sx={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }} />
                          <Typography variant="caption" sx={{ color: '#78716C' }}>
                            {alert.createdAt?.toDate ? alert.createdAt.toDate().toLocaleString() : 'Unknown time'}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )
              )}
            </CardContent>
          </Card>
        </Grid>

      </Grid>

      {/* Force Logout Dialog */}
      <Dialog open={!!confirmLogout} onClose={() => setConfirmLogout(null)} PaperProps={{ sx: { background: '#0D1B2A', border: '1px solid rgba(245,158,11,0.2)', color: '#F0F6FF' } }}>
        <DialogTitle sx={{ color: '#F59E0B' }}>Confirm Force Logout</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to force logout {confirmLogout?.email}?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLogout(null)} sx={{ color: '#94A3B8' }}>Cancel</Button>
          <Button onClick={handleForceLogout} color="error" variant="contained">Force Logout</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
