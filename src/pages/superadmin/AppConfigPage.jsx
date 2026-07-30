import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, IconButton, Button, TextField, Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions, Chip
} from '@mui/material';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp, addDoc } from 'firebase/firestore';
import db from '../../data/firebase';
import { useAuth } from '../../App';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const cardStyle = {
  background: 'rgba(17,30,46,0.9)',
  border: '1px solid rgba(245,158,11,0.2)',
  backdropFilter: 'blur(20px)',
  borderRadius: 3,
  color: '#F0F6FF'
};

const textFieldStyle = {
  '& .MuiOutlinedInput-root': {
    color: '#F0F6FF',
    '& fieldset': { borderColor: 'rgba(245,158,11,0.3)' },
    '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.5)' },
    '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
  },
  '& .MuiInputLabel-root': { color: '#94A3B8' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#F59E0B' },
};

const DEFAULT_CONFIG = {
  appName: 'FinGuard',
  supportEmail: 'support@finguard.com',
  minAppVersion: '1.0.0',
  maxTransactionLimit: 100000,
  loanInterestRate: 12.5,
  trialPeriodDays: 30,
  currencySymbol: 'Rs.',
  privacyPolicyUrl: '',
  termsUrl: ''
};

export default function AppConfigPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [originalConfig, setOriginalConfig] = useState(DEFAULT_CONFIG);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchConfig();
    fetchHistory();
  }, []);

  const fetchConfig = async () => {
    try {
      const docRef = doc(db, 'appConfig', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(data);
        setOriginalConfig(data);
        
        if (data.updatedAt && data.updatedBy) {
          const userDoc = await getDoc(doc(db, 'users', data.updatedBy));
          const userName = userDoc.exists() ? userDoc.data().name || userDoc.data().email : data.updatedBy;
          setLastUpdated({
            name: userName,
            time: data.updatedAt.toDate ? data.updatedAt.toDate().toLocaleString() : 'Unknown'
          });
        }
      } else {
        // Init with default if not exists
        await setDoc(docRef, DEFAULT_CONFIG);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const q = query(
        collection(db, 'auditLog'),
        where('action', '==', 'APP_CONFIG_UPDATED'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const snap = await getDocs(q);
      const hist = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(hist);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => {
      const updated = { ...prev, [name]: value };
      setIsDirty(JSON.stringify(updated) !== JSON.stringify(originalConfig));
      return updated;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'appConfig', 'global');
      
      const configToSave = {
        ...config,
        maxTransactionLimit: Number(config.maxTransactionLimit),
        loanInterestRate: Number(config.loanInterestRate),
        trialPeriodDays: Number(config.trialPeriodDays),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      };
      
      await setDoc(docRef, configToSave);
      
      // Calculate what changed
      const changes = {};
      Object.keys(config).forEach(key => {
        if (config[key] !== originalConfig[key]) {
          changes[key] = { from: originalConfig[key], to: config[key] };
        }
      });
      
      await addDoc(collection(db, 'auditLog'), {
        action: 'APP_CONFIG_UPDATED',
        details: changes,
        createdAt: serverTimestamp(),
        user: user.uid,
        userName: user.displayName || user.email
      });

      setOriginalConfig(configToSave);
      setIsDirty(false);
      setSnackbar({ open: true, message: 'Configuration saved successfully', severity: 'success' });
      fetchHistory();
      fetchConfig();
    } catch (error) {
      console.error("Save error:", error);
      setSnackbar({ open: true, message: 'Failed to save configuration', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setIsDirty(true);
    setResetDialogOpen(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#070D18', p: { xs: 2, md: 4 }, color: '#F0F6FF' }}>
      
      {/* Header */}
      <Box sx={{ mb: 4, p: 3, borderRadius: 3, background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(13,27,42,0.5) 100%)', border: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(20px)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/super-admin')} sx={{ color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ p: 1.5, borderRadius: 3, background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', boxShadow: '0 6px 20px rgba(245,158,11,0.35)' }}>
              <SettingsIcon sx={{ color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>App Configuration</Typography>
              <Typography sx={{ color: '#78716C', mt: 0.5 }}>Manage global platform settings</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button 
              variant="outlined" 
              startIcon={<RestoreIcon />} 
              onClick={() => setResetDialogOpen(true)}
              sx={{ color: '#FCD34D', borderColor: 'rgba(245,158,11,0.5)' }}
            >
              Reset Defaults
            </Button>
            <Button 
              variant="contained" 
              startIcon={<SaveIcon />} 
              onClick={handleSave}
              disabled={loading || !isDirty}
              sx={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', '&:hover': { background: '#D97706' }, '&.Mui-disabled': { background: 'rgba(245,158,11,0.3)', color: '#94A3B8' } }}
            >
              Save Config
            </Button>
          </Box>
        </Box>
      </Box>

      {isDirty && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 3, backgroundColor: 'rgba(245,158,11,0.1)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)' }}>
          You have unsaved changes. Don't forget to save your configuration.
        </Alert>
      )}

      <Grid container spacing={3}>
        
        <Grid item xs={12} md={8}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 3 }}>
              {lastUpdated && (
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>Last updated by:</Typography>
                  <Chip size="small" label={lastUpdated.name} sx={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#FCD34D' }} />
                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>on {lastUpdated.time}</Typography>
                </Box>
              )}
              
              <Typography variant="h6" sx={{ color: '#FCD34D', mb: 3 }}>General Settings</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="App Name" name="appName" value={config.appName} onChange={handleChange} sx={textFieldStyle} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Support Email" name="supportEmail" type="email" value={config.supportEmail} onChange={handleChange} sx={textFieldStyle} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Min App Version" name="minAppVersion" value={config.minAppVersion} onChange={handleChange} sx={textFieldStyle} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Currency Symbol" name="currencySymbol" value={config.currencySymbol} onChange={handleChange} sx={textFieldStyle} />
                </Grid>
              </Grid>

              <Typography variant="h6" sx={{ color: '#FCD34D', mb: 3, mt: 4 }}>Financial Settings</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Max Transaction Limit" name="maxTransactionLimit" type="number" value={config.maxTransactionLimit} onChange={handleChange} sx={textFieldStyle} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Loan Interest Rate (%)" name="loanInterestRate" type="number" value={config.loanInterestRate} onChange={handleChange} sx={textFieldStyle} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Trial Period (Days)" name="trialPeriodDays" type="number" value={config.trialPeriodDays} onChange={handleChange} sx={textFieldStyle} />
                </Grid>
              </Grid>

              <Typography variant="h6" sx={{ color: '#FCD34D', mb: 3, mt: 4 }}>Legal URLs</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Privacy Policy URL" name="privacyPolicyUrl" value={config.privacyPolicyUrl} onChange={handleChange} sx={textFieldStyle} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Terms of Service URL" name="termsUrl" value={config.termsUrl} onChange={handleChange} sx={textFieldStyle} />
                </Grid>
              </Grid>

            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <HistoryIcon sx={{ color: '#FCD34D' }} />
                <Typography variant="h6" sx={{ color: '#FCD34D' }}>Change History</Typography>
              </Box>
              
              {history.length === 0 ? (
                <Typography sx={{ color: '#78716C', textAlign: 'center', mt: 4 }}>No history available</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {history.map((log) => (
                    <Box key={log.id} sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#F0F6FF' }}>Updated by {log.userName || log.user}</Typography>
                      <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                        {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Recent'}
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        {log.details && Object.keys(log.details).map(key => (
                          <Typography key={key} variant="caption" sx={{ display: 'block', color: '#94A3B8' }}>
                            • <span style={{ color: '#FCD34D' }}>{key}</span> changed
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        
      </Grid>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} PaperProps={{ style: { backgroundColor: '#070D18', border: '1px solid rgba(245,158,11,0.2)', color: '#F0F6FF' } }}>
        <DialogTitle sx={{ color: '#F59E0B' }}>Reset to Defaults?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#94A3B8' }}>This will revert all settings to their system defaults. This action must be saved to take effect. Are you sure?</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setResetDialogOpen(false)} sx={{ color: '#94A3B8' }}>Cancel</Button>
          <Button onClick={handleReset} variant="contained" color="error" sx={{ background: '#EF4444' }}>Reset</Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}
