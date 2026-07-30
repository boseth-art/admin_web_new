import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import db from '../../data/firebase';
import { useAuth } from '../../App';
import {
  Box, Card, CardContent, Typography, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem, TextField, Switch, FormControlLabel, Grid
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import CodeIcon from '@mui/icons-material/Code';

const COLLECTIONS = ['users', 'transactions', 'notifications', 'featureFlags', 'auditLog', 'securityLog', 'appConfig', 'adminPermissions'];

export default function DatabaseInspectorPage() {
  const navigate = useNavigate();
  const { user } = useAuth() || {};

  const [selectedCol, setSelectedCol] = useState(COLLECTIONS[0]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [liveUpdates, setLiveUpdates] = useState(false);
  
  const [searchField, setSearchField] = useState('');
  const [searchValue, setSearchValue] = useState('');
  
  const [selectedDoc, setSelectedDoc] = useState(null);

  const logAccess = async (colName) => {
    try {
      await addDoc(collection(db, 'auditLog'), {
        action: 'READ_COLLECTION',
        collection: colName,
        timestamp: new Date(),
        uid: user?.uid || 'unknown_admin'
      });
    } catch (e) {
      console.warn('Audit log failed', e);
    }
  };

  const fetchDocuments = async (colName, searchF = searchField, searchV = searchValue) => {
    setLoading(true);
    setError(null);
    try {
      let q = collection(db, colName);
      if (searchF && searchV) {
        let val = searchV;
        if (searchV === 'true') val = true;
        if (searchV === 'false') val = false;
        if (!isNaN(searchV) && searchV.trim() !== '') val = Number(searchV);
        
        q = query(collection(db, colName), where(searchF, '==', val));
      }
      
      const snap = await getDocs(q);
      setDocuments(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
      logAccess(colName);
    } catch (err) {
      console.error(err);
      setError(`Failed to fetch collection ${colName}. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsub = null;
    
    if (liveUpdates) {
      setLoading(true);
      setError(null);
      try {
        let q = collection(db, selectedCol);
        if (searchField && searchValue) {
          let val = searchValue;
          if (searchValue === 'true') val = true;
          if (searchValue === 'false') val = false;
          if (!isNaN(searchValue) && searchValue.trim() !== '') val = Number(searchValue);
          q = query(collection(db, selectedCol), where(searchField, '==', val));
        }
        
        unsub = onSnapshot(q, (snap) => {
          setDocuments(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          setLoading(false);
        }, (err) => {
          console.error(err);
          setError(`Live update failed for ${selectedCol}.`);
          setLoading(false);
        });
        logAccess(selectedCol);
      } catch (err) {
        setError(`Failed to start live listener. ${err.message}`);
        setLoading(false);
      }
    } else {
      fetchDocuments(selectedCol);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [selectedCol, liveUpdates]); 

  const handleSearch = () => {
    fetchDocuments(selectedCol);
  };

  const renderDocValue = (val) => {
    if (val === null) return 'null';
    if (typeof val === 'boolean') return val.toString();
    if (typeof val === 'object') {
      if (val?.seconds) return new Date(val.seconds * 1000).toLocaleString();
      return '[Object]';
    }
    return String(val).substring(0, 30) + (String(val).length > 30 ? '...' : '');
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
            <StorageIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Database Inspector</Typography>
            <Typography sx={{ color: '#78716C', mt: 0.5 }}>Raw read-only access to Firestore collections</Typography>
          </Box>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Card sx={{ background: 'rgba(17,30,46,0.9)', border: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(20px)', mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#94A3B8' }}>Collection</InputLabel>
                <Select
                  value={selectedCol}
                  label="Collection"
                  onChange={(e) => setSelectedCol(e.target.value)}
                  sx={{ color: '#F0F6FF', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(245,158,11,0.2)' } }}
                >
                  {COLLECTIONS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField 
                size="small" 
                label="Field (e.g. role)" 
                value={searchField} 
                onChange={(e) => setSearchField(e.target.value)}
                fullWidth
                InputLabelProps={{ style: { color: '#94A3B8' } }}
                sx={{ input: { color: '#F0F6FF' }, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(245,158,11,0.2)' } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField 
                size="small" 
                label="Value" 
                value={searchValue} 
                onChange={(e) => setSearchValue(e.target.value)}
                fullWidth
                InputLabelProps={{ style: { color: '#94A3B8' } }}
                sx={{ input: { color: '#F0F6FF' }, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(245,158,11,0.2)' } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button 
                variant="outlined" 
                onClick={handleSearch} 
                startIcon={<SearchIcon />}
                fullWidth
                sx={{ color: '#F59E0B', borderColor: '#F59E0B', height: '40px' }}
              >
                Search
              </Button>
            </Grid>
            <Grid item xs={12} md={3} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <FormControlLabel
                control={<Switch checked={liveUpdates} onChange={(e) => setLiveUpdates(e.target.checked)} color="warning" />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Live Updates
                    {liveUpdates && <FiberManualRecordIcon sx={{ color: '#10B981', fontSize: 14, animation: 'pulse 1.5s infinite' }} />}
                  </Box>
                }
                sx={{ color: '#F0F6FF' }}
              />
              <Chip label={`${documents.length} docs`} sx={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B', ml: 2 }} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ background: 'rgba(17,30,46,0.9)', border: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(20px)' }}>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress sx={{ color: '#F59E0B' }} />
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: '60vh' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ background: '#0D1B2A', color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Doc ID</TableCell>
                    <TableCell sx={{ background: '#0D1B2A', color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Field 1</TableCell>
                    <TableCell sx={{ background: '#0D1B2A', color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Field 2</TableCell>
                    <TableCell sx={{ background: '#0D1B2A', color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Field 3</TableCell>
                    <TableCell sx={{ background: '#0D1B2A', color: '#94A3B8', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>Field 4</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: '#78716C', borderBottom: 'none' }}>
                        No documents found in {selectedCol}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => {
                      const keys = Object.keys(doc).filter(k => k !== '_id').slice(0, 4);
                      return (
                        <TableRow 
                          key={doc._id} 
                          hover 
                          onClick={() => setSelectedDoc(doc)}
                          sx={{ 
                            cursor: 'pointer', 
                            '&:hover': { background: 'rgba(245,158,11,0.05) !important' },
                            '.MuiTableCell-root': { borderBottom: '1px solid rgba(245,158,11,0.1)' }
                          }}
                        >
                          <TableCell sx={{ color: '#F59E0B', fontFamily: 'monospace' }}>{doc._id}</TableCell>
                          <TableCell sx={{ color: '#F0F6FF' }}>{keys[0] ? `${keys[0]}: ${renderDocValue(doc[keys[0]])}` : '-'}</TableCell>
                          <TableCell sx={{ color: '#F0F6FF' }}>{keys[1] ? `${keys[1]}: ${renderDocValue(doc[keys[1]])}` : '-'}</TableCell>
                          <TableCell sx={{ color: '#F0F6FF' }}>{keys[2] ? `${keys[2]}: ${renderDocValue(doc[keys[2]])}` : '-'}</TableCell>
                          <TableCell sx={{ color: '#F0F6FF' }}>{keys[3] ? `${keys[3]}: ${renderDocValue(doc[keys[3]])}` : '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Document Viewer Dialog */}
      <Dialog 
        open={!!selectedDoc} 
        onClose={() => setSelectedDoc(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { background: '#0D1B2A', border: '1px solid rgba(245,158,11,0.2)', color: '#F0F6FF' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CodeIcon sx={{ color: '#F59E0B' }} />
            <Typography variant="h6">Document Viewer</Typography>
          </Box>
          {selectedDoc && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip size="small" label={`ID: ${selectedDoc._id}`} sx={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }} />
              <Chip size="small" label={`${Object.keys(selectedDoc).length - 1} Fields`} sx={{ background: 'rgba(255,255,255,0.1)', color: '#F0F6FF' }} />
            </Box>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, background: '#070D18', overflowX: 'auto' }}>
            <pre style={{ margin: 0, color: '#A7F3D0', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {selectedDoc && JSON.stringify(Object.fromEntries(Object.entries(selectedDoc).filter(([k]) => k !== '_id')), null, 2)}
            </pre>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(245,158,11,0.1)' }}>
          <Button onClick={() => setSelectedDoc(null)} sx={{ color: '#F59E0B' }}>Close</Button>
        </DialogActions>
      </Dialog>
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </Box>
  );
}
