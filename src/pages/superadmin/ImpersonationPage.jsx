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
  Avatar,
  Chip,
  Grid,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ManageAccounts as ManageAccountsIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  Notifications as NotificationsIcon,
  Visibility as VisibilityIcon,
  Send as SendIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  WarningAmber as WarningAmberIcon
} from '@mui/icons-material';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../data/firebase';
import { useAuth } from '../../App';

const ImpersonationPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  
  const [notificationDialog, setNotificationDialog] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [isSendingNotif, setIsSendingNotif] = useState(false);
  
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, title: '', desc: '' });
  
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    setSelectedUser(null);
    try {
      const usersRef = collection(db, 'users');
      // Simplified search for demo purposes - querying by email
      const q = query(usersRef, where('email', '>=', searchTerm), where('email', '<=', searchTerm + '\uf8ff'), limit(10));
      const querySnapshot = await getDocs(q);
      const results = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
      setToast({ open: true, message: 'Failed to search users', severity: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setIsLoadingProfile(true);
    setSearchResults([]);
    
    try {
      // Audit log
      await addDoc(collection(db, 'auditLog'), {
        action: 'USER_IMPERSONATION_VIEW',
        targetUid: user.id,
        targetEmail: user.email,
        actorUid: currentUser?.uid || 'unknown',
        timestamp: serverTimestamp()
      });

      // Fetch transactions
      const txRef = collection(db, 'transactions');
      const txQ = query(txRef, where('user', '==', user.email), orderBy('date', 'desc'), limit(20));
      const txSnapshot = await getDocs(txQ);
      const txs = [];
      txSnapshot.forEach(doc => txs.push({ id: doc.id, ...doc.data() }));
      setTransactions(txs);

      // Fetch notifications
      const notifRef = collection(db, 'notifications');
      const notifQ = query(notifRef, where('uid', '==', user.id), orderBy('createdAt', 'desc'), limit(10));
      const notifSnapshot = await getDocs(notifQ);
      const notifs = [];
      notifSnapshot.forEach(doc => notifs.push({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
      
    } catch (error) {
      console.error("Profile fetch error:", error);
      // It's possible indexes don't exist yet, gracefully handle it
      setToast({ open: true, message: 'Loaded user, but some data may require Firestore indexes to view', severity: 'warning' });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notifTitle || !notifBody || !selectedUser) return;
    setIsSendingNotif(true);
    try {
      const functions = getFunctions();
      const createAdminNotification = httpsCallable(functions, 'createAdminNotification');
      await createAdminNotification({
        uid: selectedUser.id,
        title: notifTitle,
        body: notifBody
      });
      setToast({ open: true, message: 'Notification sent', severity: 'success' });
      setNotificationDialog(false);
      setNotifTitle('');
      setNotifBody('');
    } catch (error) {
      console.error(error);
      // Fallback if function doesn't exist
      try {
         await addDoc(collection(db, 'notifications'), {
            uid: selectedUser.id,
            title: notifTitle,
            message: notifBody,
            createdAt: serverTimestamp(),
            read: false,
            type: 'admin'
         });
         setToast({ open: true, message: 'Notification added to DB (fallback)', severity: 'success' });
         setNotificationDialog(false);
         setNotifTitle('');
         setNotifBody('');
      } catch(err2) {
         setToast({ open: true, message: 'Failed to send notification', severity: 'error' });
      }
    } finally {
      setIsSendingNotif(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        status: newStatus
      });
      
      await addDoc(collection(db, 'auditLog'), {
        action: `USER_STATUS_CHANGE_${newStatus.toUpperCase()}`,
        targetUid: selectedUser.id,
        actorUid: currentUser?.uid || 'unknown',
        timestamp: serverTimestamp()
      });

      setSelectedUser({ ...selectedUser, status: newStatus });
      setToast({ open: true, message: `User status updated to ${newStatus}`, severity: 'success' });
    } catch (error) {
      console.error(error);
      setToast({ open: true, message: 'Failed to update user status', severity: 'error' });
    } finally {
      setConfirmDialog({ open: false, action: null, title: '', desc: '' });
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const cardStyle = {
    background: 'rgba(17,30,46,0.9)',
    border: '1px solid rgba(245,158,11,0.2)',
    backdropFilter: 'blur(20px)',
    borderRadius: 3
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
            <ManageAccountsIcon sx={{ color: '#fff', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>User Impersonation</Typography>
            <Typography sx={{ color: '#78716C', mt: 0.5 }}>View detailed user profiles and perform administrative actions.</Typography>
          </Box>
        </Box>
      </Box>

      {selectedUser && (
        <Alert icon={<WarningAmberIcon />} severity="warning" sx={{ mb: 3, backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#FCD34D', border: '1px solid rgba(245, 158, 11, 0.3)', '& .MuiAlert-icon': { color: '#F59E0B' } }}>
          Read-only view — you are viewing this profile in impersonation mode. Actions are audited.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={selectedUser ? 8 : 12}>
          
          {/* SEARCH CARD */}
          {!selectedUser && (
            <Card sx={cardStyle}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: '#FCD34D' }}>Search Users</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search by email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ color: '#94A3B8', mr: 1 }} />,
                      sx: { color: '#F0F6FF', bgcolor: 'rgba(13,27,42,0.8)', '& fieldset': { borderColor: 'rgba(245,158,11,0.2)' }, '&:hover fieldset': { borderColor: '#F59E0B' }, '&.Mui-focused fieldset': { borderColor: '#F59E0B' } }
                    }}
                  />
                  <Button 
                    variant="contained" 
                    onClick={handleSearch}
                    disabled={isSearching}
                    sx={{ bgcolor: '#F59E0B', color: '#070D18', fontWeight: 'bold', '&:hover': { bgcolor: '#D97706' }, px: 4 }}
                  >
                    {isSearching ? <CircularProgress size={24} sx={{ color: '#070D18' }} /> : 'Search'}
                  </Button>
                </Box>
                
                {searchResults.length > 0 && (
                  <List sx={{ mt: 3, bgcolor: 'rgba(13,27,42,0.5)', borderRadius: 2 }}>
                    {searchResults.map((u, i) => (
                      <React.Fragment key={u.id}>
                        {i > 0 && <Divider sx={{ borderColor: 'rgba(245,158,11,0.1)' }} />}
                        <ListItem 
                          button 
                          onClick={() => handleSelectUser(u)}
                          sx={{ '&:hover': { bgcolor: 'rgba(245,158,11,0.1)' } }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'rgba(245,158,11,0.2)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.5)' }}>
                              {getInitials(u.name || u.email)}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText 
                            primary={<Typography sx={{ color: '#F0F6FF', fontWeight: 'bold' }}>{u.name || 'No Name'}</Typography>}
                            secondary={<Typography sx={{ color: '#94A3B8', fontSize: '0.875rem' }}>{u.email}</Typography>}
                          />
                          <Chip size="small" label={u.role || 'user'} sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)' }} />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          )}

          {/* PROFILE VIEW */}
          {isLoadingProfile && <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress sx={{ color: '#F59E0B' }} /></Box>}
          
          {selectedUser && !isLoadingProfile && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              {/* Header Profile */}
              <Card sx={cardStyle}>
                <CardContent sx={{ position: 'relative' }}>
                  <IconButton 
                    onClick={() => setSelectedUser(null)} 
                    sx={{ position: 'absolute', top: 8, right: 8, color: '#94A3B8' }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                  
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                    <Avatar sx={{ width: 80, height: 80, fontSize: 32, fontWeight: 'bold', background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: '2px solid #FCD34D' }}>
                      {getInitials(selectedUser.name || selectedUser.email)}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h5" fontWeight="bold" sx={{ color: '#F0F6FF' }}>{selectedUser.name || 'No Name'}</Typography>
                        <Chip size="small" label={selectedUser.status === 'suspended' ? 'Suspended' : 'Active'} sx={{ bgcolor: selectedUser.status === 'suspended' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)', color: selectedUser.status === 'suspended' ? '#FCA5A5' : '#86EFAC', border: `1px solid ${selectedUser.status === 'suspended' ? '#EF4444' : '#22C55E'}` }} />
                        <Chip size="small" label={selectedUser.role || 'user'} sx={{ bgcolor: 'rgba(245,158,11,0.2)', color: '#FCD34D' }} />
                      </Box>
                      <Typography sx={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}><PersonIcon fontSize="small" /> UID: {selectedUser.id}</Typography>
                      <Typography sx={{ color: '#94A3B8' }}>{selectedUser.email} {selectedUser.phone ? `• ${selectedUser.phone}` : ''}</Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 3, borderColor: 'rgba(245,158,11,0.1)' }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Typography sx={{ color: '#78716C', fontSize: '0.875rem' }}>Plan</Typography>
                      <Typography sx={{ color: '#F0F6FF', fontWeight: 'bold' }}>{selectedUser.plan || 'Free'}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography sx={{ color: '#78716C', fontSize: '0.875rem' }}>Balance</Typography>
                      <Typography sx={{ color: '#F0F6FF', fontWeight: 'bold' }}>${selectedUser.balance || '0.00'}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography sx={{ color: '#78716C', fontSize: '0.875rem' }}>Joined</Typography>
                      <Typography sx={{ color: '#F0F6FF', fontWeight: 'bold' }}>{selectedUser.createdAt ? new Date(selectedUser.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography sx={{ color: '#78716C', fontSize: '0.875rem' }}>Age / Tx Count</Typography>
                      <Typography sx={{ color: '#F0F6FF', fontWeight: 'bold' }}>{selectedUser.age || 'N/A'} / {selectedUser.transactionsCount || 0}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                       <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                         {selectedUser.hasLoan && <Chip size="small" label="Has Loan" color="primary" variant="outlined" sx={{ color: '#60A5FA', borderColor: '#3B82F6' }} />}
                         {selectedUser.hasSavingPlan && <Chip size="small" label="Has Saving Plan" color="success" variant="outlined" sx={{ color: '#34D399', borderColor: '#10B981' }} />}
                       </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Transactions Timeline */}
              <Card sx={cardStyle}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: '#FCD34D', display: 'flex', alignItems: 'center', gap: 1 }}><ReceiptIcon /> Recent Transactions</Typography>
                  {transactions.length === 0 ? (
                    <Typography sx={{ color: '#78716C', fontStyle: 'italic' }}>No recent transactions.</Typography>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {transactions.map((tx, i) => (
                        <React.Fragment key={tx.id}>
                          {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
                          <ListItem sx={{ px: 0 }}>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography sx={{ color: '#F0F6FF', fontWeight: 'bold' }}>{tx.title || tx.category || 'Transaction'}</Typography>
                                  <Typography sx={{ color: tx.type === 'expense' ? '#FCA5A5' : '#86EFAC', fontWeight: 'bold' }}>
                                    {tx.type === 'expense' ? '-' : '+'}${tx.amount}
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Chip size="small" label={tx.category || 'general'} sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(255,255,255,0.1)', color: '#94A3B8' }} />
                                    <Chip size="small" label={tx.status || 'completed'} sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(34,197,94,0.1)', color: '#86EFAC' }} />
                                  </Box>
                                  <Typography sx={{ fontSize: '0.75rem', color: '#78716C' }}>
                                    {tx.date ? new Date(tx.date.seconds ? tx.date.seconds * 1000 : tx.date).toLocaleDateString() : ''}
                                  </Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>

              {/* Notifications History */}
              <Card sx={cardStyle}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: '#FCD34D', display: 'flex', alignItems: 'center', gap: 1 }}><NotificationsIcon /> Notification History</Typography>
                  {notifications.length === 0 ? (
                    <Typography sx={{ color: '#78716C', fontStyle: 'italic' }}>No notifications found.</Typography>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {notifications.map((n, i) => (
                        <React.Fragment key={n.id}>
                          {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
                          <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                            <Box sx={{ mt: 0.5, mr: 2, color: n.read ? '#78716C' : '#F59E0B' }}>
                              <NotificationsIcon fontSize="small" />
                            </Box>
                            <ListItemText
                              primary={<Typography sx={{ color: '#F0F6FF', fontWeight: n.read ? 'normal' : 'bold' }}>{n.title}</Typography>}
                              secondary={
                                <React.Fragment>
                                  <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem', display: 'block' }}>{n.message || n.body}</Typography>
                                  <Typography sx={{ color: '#78716C', fontSize: '0.75rem', mt: 0.5 }}>
                                    {n.createdAt ? new Date(n.createdAt.seconds * 1000).toLocaleString() : ''}
                                  </Typography>
                                </React.Fragment>
                              }
                            />
                          </ListItem>
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>

            </Box>
          )}
        </Grid>

        {/* QUICK ACTIONS */}
        {selectedUser && !isLoadingProfile && (
          <Grid item xs={12} md={4}>
            <Card sx={cardStyle}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: '#FCD34D' }}>Quick Actions</Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    onClick={() => setNotificationDialog(true)}
                    sx={{ color: '#FCD34D', borderColor: 'rgba(245,158,11,0.5)', '&:hover': { borderColor: '#F59E0B', bgcolor: 'rgba(245,158,11,0.1)' }, justifyContent: 'flex-start' }}
                  >
                    Send Notification
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() => window.open(`/user/${selectedUser.id}`, '_blank')}
                    sx={{ color: '#F0F6FF', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }, justifyContent: 'flex-start' }}
                  >
                    View Public Profile
                  </Button>

                  <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />

                  {selectedUser.status === 'suspended' ? (
                    <Button
                      variant="contained"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => setConfirmDialog({ open: true, action: () => handleStatusChange('active'), title: 'Activate User', desc: `Are you sure you want to reactivate ${selectedUser.email}? They will regain access to the platform.` })}
                      sx={{ bgcolor: '#22C55E', color: '#000', '&:hover': { bgcolor: '#16A34A' }, justifyContent: 'flex-start' }}
                    >
                      Activate User
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<BlockIcon />}
                      onClick={() => setConfirmDialog({ open: true, action: () => handleStatusChange('suspended'), title: 'Suspend User', desc: `Are you sure you want to suspend ${selectedUser.email}? They will be logged out and unable to access their account.` })}
                      sx={{ bgcolor: '#EF4444', color: '#fff', '&:hover': { bgcolor: '#DC2626' }, justifyContent: 'flex-start' }}
                    >
                      Suspend User
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Send Notification Dialog */}
      <Dialog 
        open={notificationDialog} 
        onClose={() => setNotificationDialog(false)}
        PaperProps={{ sx: { background: '#0D1B2A', border: '1px solid rgba(245,158,11,0.3)', color: '#fff' } }}
      >
        <DialogTitle sx={{ color: '#FCD34D' }}>Send Direct Notification</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            variant="outlined"
            value={notifTitle}
            onChange={(e) => setNotifTitle(e.target.value)}
            sx={{ mb: 2, mt: 1, input: { color: '#fff' }, label: { color: '#94A3B8' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
          />
          <TextField
            margin="dense"
            label="Message Body"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={notifBody}
            onChange={(e) => setNotifBody(e.target.value)}
            sx={{ input: { color: '#fff' }, textarea: { color: '#fff' }, label: { color: '#94A3B8' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setNotificationDialog(false)} sx={{ color: '#94A3B8' }}>Cancel</Button>
          <Button 
            onClick={handleSendNotification} 
            variant="contained" 
            disabled={!notifTitle || !notifBody || isSendingNotif}
            sx={{ bgcolor: '#F59E0B', color: '#000', '&:hover': { bgcolor: '#D97706' } }}
          >
            {isSendingNotif ? 'Sending...' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog 
        open={confirmDialog.open} 
        onClose={() => setConfirmDialog({ open: false, action: null, title: '', desc: '' })}
        PaperProps={{ sx: { background: '#0D1B2A', border: '1px solid rgba(245,158,11,0.3)', color: '#fff' } }}
      >
        <DialogTitle sx={{ color: '#FCD34D' }}>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.desc}</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmDialog({ open: false, action: null, title: '', desc: '' })} sx={{ color: '#94A3B8' }}>Cancel</Button>
          <Button onClick={confirmDialog.action} variant="contained" color="error">Confirm</Button>
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

export default ImpersonationPage;
