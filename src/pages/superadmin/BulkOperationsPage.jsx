import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Grid, Card, CardContent, Typography, Button, 
  TextField, MenuItem, Select, FormControl, InputLabel, 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  LinearProgress, Alert, IconButton, Paper
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FilterListIcon from '@mui/icons-material/FilterList';
import GroupIcon from '@mui/icons-material/Group';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../data/firebase';
import { useAuth } from '../../App';

export default function BulkOperationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [role, setRole] = useState('All');
  const [status, setStatus] = useState('All');
  const [dateBefore, setDateBefore] = useState('');
  const [dateAfter, setDateAfter] = useState('');
  
  const [matchedUsers, setMatchedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultSummary, setResultSummary] = useState(null);
  
  // Bulk Notify Dialog
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  
  // Bulk Deactivate Dialog
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const fetchUsers = async () => {
    setIsLoading(true);
    setResultSummary(null);
    try {
      let q = collection(db, 'users');
      let filters = [];
      
      if (role !== 'All') {
        filters.push(where('role', '==', role));
      }
      if (status !== 'All') {
        filters.push(where('status', '==', status));
      }
      
      if (filters.length > 0) {
        q = query(q, ...filters);
      }
      
      const snapshot = await getDocs(q);
      let users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Client side date filtering as Firestore composite queries can be tricky
      if (dateAfter) {
        const afterDate = new Date(dateAfter);
        users = users.filter(u => {
          if (!u.createdAt) return true;
          const userDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
          return userDate >= afterDate;
        });
      }
      if (dateBefore) {
        const beforeDate = new Date(dateBefore);
        users = users.filter(u => {
          if (!u.createdAt) return true;
          const userDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
          return userDate <= beforeDate;
        });
      }
      
      setMatchedUsers(users);
    } catch (error) {
      console.error('Error fetching users', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [role, status, dateBefore, dateAfter]);

  const processBulkAction = async (actionType) => {
    if (matchedUsers.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    setResultSummary(null);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < matchedUsers.length; i++) {
      const u = matchedUsers[i];
      try {
        if (actionType === 'suspend') {
          await updateDoc(doc(db, 'users', u.id), { status: 'suspended', updatedAt: serverTimestamp() });
        } else if (actionType === 'activate') {
          await updateDoc(doc(db, 'users', u.id), { status: 'active', updatedAt: serverTimestamp() });
        } else if (actionType === 'deactivate') {
          await updateDoc(doc(db, 'users', u.id), { status: 'deactivated', updatedAt: serverTimestamp() });
        } else if (actionType === 'notify') {
          const functions = getFunctions();
          const notify = httpsCallable(functions, 'createAdminNotification');
          await notify({ userId: u.id, title: notifyTitle, body: notifyBody });
        }
        successCount++;
      } catch (error) {
        console.error('Action failed for user', u.id, error);
        failureCount++;
      }
      setProgress(i + 1);
    }
    
    setIsProcessing(false);
    setResultSummary({ success: successCount, failure: failureCount });
    if (actionType === 'notify') setNotifyDialogOpen(false);
    if (actionType === 'deactivate') setDeactivateDialogOpen(false);
    fetchUsers(); // refresh
  };

  const cardStyle = {
    background: 'rgba(17,30,46,0.9)',
    border: '1px solid rgba(245,158,11,0.2)',
    backdropFilter: 'blur(20px)',
    borderRadius: 3,
    color: '#F0F6FF'
  };

  const goldButton = {
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#fff',
    '&:hover': {
      background: 'linear-gradient(135deg, #D97706, #B45309)'
    }
  };

  return (
    <Box sx={{ p: 4, minHeight: '100vh', background: '#070D18' }}>
      <Box sx={{ mb: 4, p: 3, borderRadius: 3, background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(13,27,42,0.5) 100%)', border: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(20px)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/super-admin')} sx={{ color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ p: 1.5, borderRadius: 3, background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', boxShadow: '0 6px 20px rgba(245,158,11,0.35)' }}>
            <GroupIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Bulk Operations</Typography>
            <Typography sx={{ color: '#78716C', mt: 0.5 }}>Manage large groups of users simultaneously</Typography>
          </Box>
        </Box>
      </Box>

      {resultSummary && (
        <Alert severity={resultSummary.failure > 0 ? "warning" : "success"} sx={{ mb: 3, background: 'rgba(17,30,46,0.9)', color: '#F0F6FF', border: '1px solid rgba(245,158,11,0.2)' }}>
          Operation complete! Success: {resultSummary.success} | Failed: {resultSummary.failure}
        </Alert>
      )}

      {isProcessing && (
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ color: '#F59E0B', mb: 1 }}>Processing: {progress} / {matchedUsers.length} users</Typography>
          <LinearProgress variant="determinate" value={matchedUsers.length > 0 ? (progress / matchedUsers.length) * 100 : 0} sx={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(245,158,11,0.2)', '& .MuiLinearProgress-bar': { backgroundColor: '#F59E0B' } }} />
        </Box>
      )}

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
                <FilterListIcon sx={{ color: '#F59E0B' }} />
                <Typography variant="h6" color="#F0F6FF">Filter Builder</Typography>
              </Box>

              <FormControl fullWidth sx={{ mb: 3, '& .MuiInputLabel-root': { color: '#94A3B8' }, '& .MuiOutlinedInput-root': { color: '#F0F6FF', fieldset: { borderColor: 'rgba(245,158,11,0.2)' } } }}>
                <InputLabel>Role</InputLabel>
                <Select value={role} label="Role" onChange={(e) => setRole(e.target.value)}>
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="Student">Student</MenuItem>
                  <MenuItem value="Business owner">Business owner</MenuItem>
                  <MenuItem value="Company worker">Company worker</MenuItem>
                  <MenuItem value="Multiple account holder">Multiple account holder</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 3, '& .MuiInputLabel-root': { color: '#94A3B8' }, '& .MuiOutlinedInput-root': { color: '#F0F6FF', fieldset: { borderColor: 'rgba(245,158,11,0.2)' } } }}>
                <InputLabel>Status</InputLabel>
                <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                  <MenuItem value="deactivated">Deactivated</MenuItem>
                </Select>
              </FormControl>

              <TextField 
                fullWidth label="Join Date (After)" type="date" 
                value={dateAfter} onChange={(e) => setDateAfter(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 3, input: { color: '#F0F6FF' }, label: { color: '#94A3B8' }, '& .MuiOutlinedInput-root': { fieldset: { borderColor: 'rgba(245,158,11,0.2)' } } }}
              />
              <TextField 
                fullWidth label="Join Date (Before)" type="date" 
                value={dateBefore} onChange={(e) => setDateBefore(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 3, input: { color: '#F0F6FF' }, label: { color: '#94A3B8' }, '& .MuiOutlinedInput-root': { fieldset: { borderColor: 'rgba(245,158,11,0.2)' } } }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ ...cardStyle, mb: 4 }}>
            <CardContent>
              <Typography variant="h6" color="#F0F6FF" mb={2}>Live Preview</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
                <Typography variant="h2" sx={{ color: '#F59E0B', fontWeight: 'bold' }}>{matchedUsers.length}</Typography>
                <Typography variant="h6" color="#94A3B8">Users Matched</Typography>
              </Box>

              <Box sx={{ maxHeight: 200, overflowY: 'auto', pr: 2, '&::-webkit-scrollbar': { width: '8px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(245,158,11,0.3)', borderRadius: '4px' } }}>
                {isLoading ? <Typography color="#94A3B8">Loading...</Typography> : 
                 matchedUsers.slice(0, 10).map((u, i) => (
                  <Box key={i} sx={{ p: 1.5, borderBottom: '1px solid rgba(245,158,11,0.1)', display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="#F0F6FF">{u.name || 'Unnamed'}</Typography>
                    <Typography color="#94A3B8">{u.email}</Typography>
                  </Box>
                ))}
                {matchedUsers.length > 10 && (
                  <Typography color="#F59E0B" sx={{ mt: 2, textAlign: 'center' }}>and {matchedUsers.length - 10} more...</Typography>
                )}
              </Box>
            </CardContent>
          </Card>

          <Card sx={cardStyle}>
            <CardContent>
              <Typography variant="h6" color="#F0F6FF" mb={3}>Bulk Actions</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Button fullWidth variant="outlined" startIcon={<BlockIcon />} 
                    disabled={matchedUsers.length === 0 || isProcessing}
                    onClick={() => processBulkAction('suspend')}
                    sx={{ color: '#F59E0B', borderColor: 'rgba(245,158,11,0.5)', p: 1.5 }}>
                    Bulk Suspend
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button fullWidth variant="outlined" startIcon={<CheckCircleIcon />} 
                    disabled={matchedUsers.length === 0 || isProcessing}
                    onClick={() => processBulkAction('activate')}
                    sx={{ color: '#4ade80', borderColor: 'rgba(74,222,128,0.5)', p: 1.5 }}>
                    Bulk Activate
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button fullWidth variant="contained" startIcon={<NotificationsIcon />} 
                    disabled={matchedUsers.length === 0 || isProcessing}
                    onClick={() => setNotifyDialogOpen(true)}
                    sx={{ ...goldButton, p: 1.5 }}>
                    Bulk Notify
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button fullWidth variant="outlined" startIcon={<DeleteSweepIcon />} 
                    disabled={matchedUsers.length === 0 || isProcessing}
                    onClick={() => setDeactivateDialogOpen(true)}
                    sx={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.5)', p: 1.5 }}>
                    Bulk Deactivate
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Notify Dialog */}
      <Dialog open={notifyDialogOpen} onClose={() => setNotifyDialogOpen(false)}
        PaperProps={{ style: { background: '#0D1B2A', border: '1px solid rgba(245,158,11,0.2)', color: '#F0F6FF' } }}>
        <DialogTitle sx={{ color: '#F59E0B' }}>Send Bulk Notification</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" margin="dense" value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)}
            sx={{ mt: 2, input: { color: '#F0F6FF' }, label: { color: '#94A3B8' }, '& .MuiOutlinedInput-root': { fieldset: { borderColor: 'rgba(245,158,11,0.2)' } } }} />
          <TextField fullWidth label="Body" margin="dense" multiline rows={3} value={notifyBody} onChange={e => setNotifyBody(e.target.value)}
            sx={{ mt: 2, textarea: { color: '#F0F6FF' }, label: { color: '#94A3B8' }, '& .MuiOutlinedInput-root': { fieldset: { borderColor: 'rgba(245,158,11,0.2)' } } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNotifyDialogOpen(false)} sx={{ color: '#94A3B8' }}>Cancel</Button>
          <Button onClick={() => processBulkAction('notify')} disabled={!notifyTitle || !notifyBody} sx={goldButton}>Send to {matchedUsers.length}</Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={deactivateDialogOpen} onClose={() => setDeactivateDialogOpen(false)}
        PaperProps={{ style: { background: '#0D1B2A', border: '1px solid rgba(239,68,68,0.5)', color: '#F0F6FF' } }}>
        <DialogTitle sx={{ color: '#ef4444' }}>DANGER: Bulk Deactivate</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>This will deactivate {matchedUsers.length} users. Type <strong>CONFIRM DELETE</strong> below to proceed.</Typography>
          <TextField fullWidth placeholder="CONFIRM DELETE" value={confirmText} onChange={e => setConfirmText(e.target.value)}
            sx={{ input: { color: '#F0F6FF' }, '& .MuiOutlinedInput-root': { fieldset: { borderColor: 'rgba(239,68,68,0.5)' } } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeactivateDialogOpen(false)} sx={{ color: '#94A3B8' }}>Cancel</Button>
          <Button onClick={() => processBulkAction('deactivate')} disabled={confirmText !== 'CONFIRM DELETE'} sx={{ background: '#ef4444', color: '#fff', '&:hover': { background: '#dc2626' } }}>Deactivate All</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
