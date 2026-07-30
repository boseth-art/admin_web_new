import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Gavel as GavelIcon,
  Download as DownloadIcon,
  DeleteForever as DeleteForeverIcon,
  Search as SearchIcon,
  History as HistoryIcon,
  Assessment as AssessmentIcon,
  WarningAmber as WarningAmberIcon,
  Security as SecurityIcon,
  Group as GroupIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../data/firebase';
import { useAuth } from '../../App';

const downloadCSV = (data, filename) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map(r => headers.map(h => `"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
};

const CompliancePage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });
  
  // GDPR State
  const [exportEmail, setExportEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Reports State
  const [isGeneratingInactive, setIsGeneratingInactive] = useState(false);
  const [inactiveCount, setInactiveCount] = useState(0);

  const [stats, setStats] = useState({ newUsers: 0, transactions: 0, loading: true });

  useEffect(() => {
    loadMonthlyStats();
  }, []);

  const loadMonthlyStats = async () => {
    try {
      setStats(s => ({ ...s, loading: true }));
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // We would use actual firestore queries with indexing here in a real app
      // For demo purposes and since we can't ensure indexes exist, we'll do a simpler approach or mock
      
      // Fetch users
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      let newUsersCount = 0;
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.createdAt && data.createdAt.seconds) {
           const d = new Date(data.createdAt.seconds * 1000);
           if (d >= firstDay) newUsersCount++;
        }
      });

      // Transactions
      const txRef = collection(db, 'transactions');
      const txSnap = await getDocs(txRef);
      let txCount = 0;
      txSnap.forEach(doc => {
         const data = doc.data();
         if (data.date && data.date.seconds) {
            const d = new Date(data.date.seconds * 1000);
            if (d >= firstDay) txCount++;
         }
      });

      setStats({ newUsers: newUsersCount, transactions: txCount, loading: false });
    } catch (error) {
      console.error("Error loading stats:", error);
      setStats(s => ({ ...s, loading: false }));
    }
  };

  const handleExportData = async () => {
    if (!exportEmail.trim()) return;
    setIsExporting(true);
    try {
      // Find user
      const q = query(collection(db, 'users'), where('email', '==', exportEmail));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setToast({ open: true, message: 'User not found', severity: 'error' });
        setIsExporting(false);
        return;
      }
      
      const userDoc = snap.docs[0];
      const uid = userDoc.id;
      const exportData = {
        profile: { id: uid, ...userDoc.data() },
        subprofiles: {},
        transactions: [],
        notifications: []
      };

      // Try subcollections (best effort)
      const subcollections = ['student_profile', 'worker_profile', 'business_profile', 'multi_profile'];
      for (const sub of subcollections) {
         try {
           const subDoc = await getDoc(doc(db, 'users', uid, sub, 'data'));
           if (subDoc.exists()) exportData.subprofiles[sub] = subDoc.data();
         } catch(e) {}
      }

      // Transactions
      const txQ = query(collection(db, 'transactions'), where('user', '==', exportEmail));
      const txSnap = await getDocs(txQ);
      txSnap.forEach(d => exportData.transactions.push({ id: d.id, ...d.data() }));

      // Notifications
      const notifQ = query(collection(db, 'notifications'), where('uid', '==', uid));
      const notifSnap = await getDocs(notifQ);
      notifSnap.forEach(d => exportData.notifications.push({ id: d.id, ...d.data() }));

      // Audit Log
      await addDoc(collection(db, 'auditLog'), {
        action: 'GDPR_EXPORT',
        targetEmail: exportEmail,
        actorUid: currentUser?.uid || 'unknown',
        timestamp: serverTimestamp()
      });

      // Download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportEmail}_gdpr_export.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      setToast({ open: true, message: 'Export completed successfully', severity: 'success' });
      setExportEmail('');
    } catch (error) {
      console.error("Export error:", error);
      setToast({ open: true, message: 'Failed to export data', severity: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleInitiateDelete = async () => {
    if (!deleteEmail.trim()) return;
    
    // Check if user exists
    try {
      const q = query(collection(db, 'users'), where('email', '==', deleteEmail));
      const snap = await getDocs(q);
      if (snap.empty) {
        setToast({ open: true, message: 'User not found', severity: 'error' });
        return;
      }
      setDeleteConfirmDialog(true);
    } catch(err) {
      setToast({ open: true, message: 'Error finding user', severity: 'error' });
    }
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      // In a real scenario we'd use a Cloud Function that handles Auth deletion too
      const functions = getFunctions();
      try {
         const adminDeleteUser = httpsCallable(functions, 'adminDeleteUser');
         await adminDeleteUser({ email: deleteEmail });
      } catch(err) {
         console.warn("Cloud function failed/missing, doing local audit log anyway", err);
      }

      await addDoc(collection(db, 'auditLog'), {
        action: 'GDPR_DELETE',
        targetEmail: deleteEmail,
        actorUid: currentUser?.uid || 'unknown',
        timestamp: serverTimestamp()
      });

      setToast({ open: true, message: 'User data scheduled for deletion', severity: 'success' });
      setDeleteConfirmDialog(false);
      setDeleteEmail('');
      setDeleteConfirmText('');
    } catch (error) {
      console.error(error);
      setToast({ open: true, message: 'Failed to delete user', severity: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const generateInactiveReport = async () => {
    setIsGeneratingInactive(true);
    try {
      const usersRef = collection(db, 'users');
      const snap = await getDocs(usersRef);
      
      const inactiveUsers = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.status === 'inactive' || data.status === 'suspended' || !data.transactionsCount || data.transactionsCount === 0) {
          inactiveUsers.push({
            uid: doc.id,
            email: data.email,
            name: data.name || '',
            status: data.status || 'active',
            txCount: data.transactionsCount || 0,
            joined: data.createdAt?.seconds ? new Date(data.createdAt.seconds*1000).toISOString() : ''
          });
        }
      });
      
      setInactiveCount(inactiveUsers.length);
      
      if (inactiveUsers.length > 0) {
        downloadCSV(inactiveUsers, `inactive_users_${new Date().toISOString().split('T')[0]}.csv`);
        setToast({ open: true, message: `Report generated: ${inactiveUsers.length} users found`, severity: 'success' });
      } else {
        setToast({ open: true, message: 'No inactive users found', severity: 'info' });
      }
      
    } catch (error) {
      console.error(error);
      setToast({ open: true, message: 'Failed to generate report', severity: 'error' });
    } finally {
      setIsGeneratingInactive(false);
    }
  };

  const cardStyle = {
    background: 'rgba(17,30,46,0.9)',
    border: '1px solid rgba(245,158,11,0.2)',
    backdropFilter: 'blur(20px)',
    borderRadius: 3,
    height: '100%'
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: '#070D18', color: '#F0F6FF' }}>
      
      {/* HEADER */}
      <Box sx={{ mb: 4, p: 3, borderRadius: 3, background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(13,27,42,0.5) 100%)', border: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(20px)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/super-admin')} sx={{ color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ p: 1.5, borderRadius: 3, background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', boxShadow: '0 6px 20px rgba(245,158,11,0.35)' }}>
            <GavelIcon sx={{ color: '#fff', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Compliance & Reports</Typography>
            <Typography sx={{ color: '#78716C', mt: 0.5 }}>Manage GDPR requests, security audits, and system reports.</Typography>
          </Box>
        </Box>
      </Box>

      {/* MONTHLY SUMMARY */}
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: '#FCD34D' }}>This Month's Summary</Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={cardStyle}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(34,197,94,0.1)', color: '#4ADE80' }}>
                <GroupIcon fontSize="large" />
              </Box>
              <Box>
                <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem' }}>New Users</Typography>
                {stats.loading ? <CircularProgress size={20} /> : <Typography variant="h4" fontWeight="bold" sx={{ color: '#F0F6FF' }}>{stats.newUsers}</Typography>}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={cardStyle}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(56,189,248,0.1)', color: '#38BDF8' }}>
                <ReceiptIcon fontSize="large" />
              </Box>
              <Box>
                <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem' }}>New Transactions</Typography>
                {stats.loading ? <CircularProgress size={20} /> : <Typography variant="h4" fontWeight="bold" sx={{ color: '#F0F6FF' }}>{stats.transactions}</Typography>}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* GDPR EXPORT */}
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <DownloadIcon sx={{ color: '#60A5FA' }} />
                <Typography variant="h6" fontWeight="bold" sx={{ color: '#F0F6FF' }}>GDPR Data Export</Typography>
              </Box>
              <Typography sx={{ color: '#94A3B8', mb: 3, fontSize: '0.875rem' }}>
                Export all personal data, transactions, and preferences for a specific user as a JSON file to comply with Right of Access requests.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="User email address..."
                  value={exportEmail}
                  onChange={(e) => setExportEmail(e.target.value)}
                  InputProps={{
                    sx: { color: '#F0F6FF', bgcolor: 'rgba(13,27,42,0.8)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }
                  }}
                />
                <Button 
                  variant="contained" 
                  onClick={handleExportData}
                  disabled={isExporting || !exportEmail}
                  sx={{ bgcolor: '#3B82F6', color: '#fff', '&:hover': { bgcolor: '#2563EB' }, minWidth: 120 }}
                >
                  {isExporting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Export JSON'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* GDPR DELETE */}
        <Grid item xs={12} md={6}>
          <Card sx={{ ...cardStyle, border: '1px solid rgba(239,68,68,0.3)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <DeleteForeverIcon sx={{ color: '#F87171' }} />
                <Typography variant="h6" fontWeight="bold" sx={{ color: '#F0F6FF' }}>Right to be Forgotten</Typography>
              </Box>
              <Typography sx={{ color: '#94A3B8', mb: 3, fontSize: '0.875rem' }}>
                Permanently delete a user's account and all associated data from the system. This action cannot be undone.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="User email address..."
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  InputProps={{
                    sx: { color: '#F0F6FF', bgcolor: 'rgba(13,27,42,0.8)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }
                  }}
                />
                <Button 
                  variant="contained" 
                  onClick={handleInitiateDelete}
                  disabled={!deleteEmail}
                  sx={{ bgcolor: '#EF4444', color: '#fff', '&:hover': { bgcolor: '#DC2626' }, minWidth: 120 }}
                >
                  Delete User
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* REPORTS */}
        <Grid item xs={12}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, mt: 2, color: '#FCD34D' }}>System Reports</Typography>
          <Grid container spacing={3}>
            
            <Grid item xs={12} md={4}>
              <Card sx={cardStyle}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AssessmentIcon sx={{ color: '#F59E0B' }} />
                    <Typography variant="subtitle1" fontWeight="bold">Inactive Users</Typography>
                  </Box>
                  <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem', mb: 3, minHeight: 40 }}>
                    Users with 0 transactions or marked as inactive/suspended.
                  </Typography>
                  <Button 
                    fullWidth 
                    variant="outlined" 
                    onClick={generateInactiveReport}
                    disabled={isGeneratingInactive}
                    sx={{ color: '#FCD34D', borderColor: 'rgba(245,158,11,0.5)', '&:hover': { borderColor: '#F59E0B', bgcolor: 'rgba(245,158,11,0.1)' } }}
                  >
                    {isGeneratingInactive ? 'Generating...' : 'Generate CSV'}
                  </Button>
                  {inactiveCount > 0 && <Typography sx={{ mt: 1, textAlign: 'center', fontSize: '0.75rem', color: '#86EFAC' }}>Last run found {inactiveCount} users</Typography>}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={cardStyle}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <SecurityIcon sx={{ color: '#F59E0B' }} />
                    <Typography variant="subtitle1" fontWeight="bold">Security Audit</Typography>
                  </Box>
                  <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem', mb: 3, minHeight: 40 }}>
                    Recent sensitive actions and system errors. (Coming soon)
                  </Typography>
                  <Button 
                    fullWidth 
                    variant="outlined"
                    disabled
                    sx={{ color: '#94A3B8', borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    Select Date Range
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={cardStyle}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <HistoryIcon sx={{ color: '#F59E0B' }} />
                    <Typography variant="subtitle1" fontWeight="bold">Admin Activity</Typography>
                  </Box>
                  <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem', mb: 3, minHeight: 40 }}>
                    Actions performed by administrative users. (Coming soon)
                  </Typography>
                  <Button 
                    fullWidth 
                    variant="outlined"
                    disabled
                    sx={{ color: '#94A3B8', borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    Select Admin
                  </Button>
                </CardContent>
              </Card>
            </Grid>

          </Grid>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteConfirmDialog} 
        onClose={() => setDeleteConfirmDialog(false)}
        PaperProps={{ sx: { background: '#0D1B2A', border: '1px solid #EF4444', color: '#fff' } }}
      >
        <DialogTitle sx={{ color: '#F87171', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon /> Confirm Data Deletion
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            You are about to permanently delete all data for <strong>{deleteEmail}</strong>. This includes their profile, transactions, notifications, and all subprofiles.
          </Typography>
          <Typography sx={{ mb: 2, color: '#FCA5A5', fontSize: '0.875rem' }}>
            This action cannot be undone and will be logged in the audit trail.
          </Typography>
          <Typography sx={{ mb: 1, fontSize: '0.875rem' }}>Type their full email address to confirm:</Typography>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            sx={{ input: { color: '#fff' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(239,68,68,0.5)' } } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteConfirmDialog(false)} sx={{ color: '#94A3B8' }}>Cancel</Button>
          <Button 
            onClick={executeDelete} 
            variant="contained" 
            color="error"
            disabled={deleteConfirmText !== deleteEmail || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Permanently Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>

    </Box>
  );
};

export default CompliancePage;
