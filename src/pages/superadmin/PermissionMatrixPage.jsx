import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Card, CardContent, Typography, Button, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Switch, IconButton, Chip, Paper
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SecurityIcon from '@mui/icons-material/Security';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import CheckIcon from '@mui/icons-material/Check';

import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../data/firebase';
import { useAuth } from '../../App';

const PERMISSIONS = ['editUsers', 'deleteUsers', 'viewAnalytics', 'exportData', 'sendNotifications', 'manageSettings'];

export default function PermissionMatrixPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [admins, setAdmins] = useState([]);
  const [permissions, setPermissions] = useState({}); // { uid: { editUsers: bool, ... } }
  const [rowStatus, setRowStatus] = useState({}); // { uid: 'saved' | 'unsaved' | 'loading' }

  const fetchAdmins = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'admin'));
      const snapshot = await getDocs(q);
      const adminList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAdmins(adminList);
      
      const permMap = {};
      const statusMap = {};
      
      for (const admin of adminList) {
        const permDoc = await getDoc(doc(db, 'adminPermissions', admin.id));
        if (permDoc.exists()) {
          permMap[admin.id] = permDoc.data();
        } else {
          // Default all true
          const defaultPerms = {};
          PERMISSIONS.forEach(p => defaultPerms[p] = true);
          permMap[admin.id] = defaultPerms;
        }
        statusMap[admin.id] = 'saved';
      }
      
      setPermissions(permMap);
      setRowStatus(statusMap);
    } catch (error) {
      console.error('Error fetching admins', error);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleToggle = (uid, perm) => {
    setPermissions(prev => ({
      ...prev,
      [uid]: {
        ...prev[uid],
        [perm]: !prev[uid][perm]
      }
    }));
    setRowStatus(prev => ({ ...prev, [uid]: 'unsaved' }));
  };

  const handleReset = (uid) => {
    const defaultPerms = {};
    PERMISSIONS.forEach(p => defaultPerms[p] = true);
    setPermissions(prev => ({ ...prev, [uid]: defaultPerms }));
    setRowStatus(prev => ({ ...prev, [uid]: 'unsaved' }));
  };

  const handleSave = async (uid) => {
    setRowStatus(prev => ({ ...prev, [uid]: 'loading' }));
    try {
      await setDoc(doc(db, 'adminPermissions', uid), {
        ...permissions[uid],
        updatedAt: serverTimestamp()
      });
      setRowStatus(prev => ({ ...prev, [uid]: 'saved' }));
    } catch (error) {
      console.error('Error saving permissions', error);
      setRowStatus(prev => ({ ...prev, [uid]: 'unsaved' }));
    }
  };

  const cardStyle = {
    background: 'rgba(17,30,46,0.9)',
    border: '1px solid rgba(245,158,11,0.2)',
    backdropFilter: 'blur(20px)',
    borderRadius: 3
  };

  return (
    <Box sx={{ p: 4, minHeight: '100vh', background: '#070D18' }}>
      <Box sx={{ mb: 4, p: 3, borderRadius: 3, background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(13,27,42,0.5) 100%)', border: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(20px)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/super-admin')} sx={{ color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ p: 1.5, borderRadius: 3, background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', boxShadow: '0 6px 20px rgba(245,158,11,0.35)' }}>
            <SecurityIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Permission Matrix</Typography>
            <Typography sx={{ color: '#78716C', mt: 0.5 }}>Fine-grained access control for administrators</Typography>
          </Box>
        </Box>
      </Box>

      <Card sx={cardStyle}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ borderBottom: '2px solid rgba(245,158,11,0.3)' }}>
                  <TableCell sx={{ color: '#F0F6FF', fontWeight: 'bold' }}>Admin User</TableCell>
                  {PERMISSIONS.map(p => (
                    <TableCell key={p} align="center" sx={{ color: '#F59E0B', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                      {p.replace(/([A-Z])/g, ' $1').trim()}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ color: '#F0F6FF', fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admins.map(admin => {
                  const isUnsaved = rowStatus[admin.id] === 'unsaved';
                  const isSaved = rowStatus[admin.id] === 'saved';
                  const isLoading = rowStatus[admin.id] === 'loading';
                  
                  return (
                    <TableRow key={admin.id} sx={{ 
                      borderBottom: '1px solid rgba(245,158,11,0.1)',
                      background: isUnsaved ? 'rgba(245,158,11,0.05)' : 'transparent',
                      transition: 'background 0.3s'
                    }}>
                      <TableCell>
                        <Typography color="#F0F6FF" fontWeight="bold">{admin.name || 'Unnamed'}</Typography>
                        <Typography color="#94A3B8" variant="body2">{admin.email}</Typography>
                      </TableCell>
                      
                      {PERMISSIONS.map(p => (
                        <TableCell key={p} align="center">
                          <Switch 
                            checked={!!permissions[admin.id]?.[p]}
                            onChange={() => handleToggle(admin.id, p)}
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': { color: '#F59E0B' },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#F59E0B' }
                            }}
                          />
                        </TableCell>
                      ))}

                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <IconButton onClick={() => handleReset(admin.id)} sx={{ color: '#94A3B8' }} title="Reset to Defaults">
                            <RestoreIcon />
                          </IconButton>
                          <Button 
                            variant="contained" 
                            disabled={isLoading || isSaved}
                            onClick={() => handleSave(admin.id)}
                            startIcon={isSaved ? <CheckIcon /> : <SaveIcon />}
                            sx={{
                              background: isSaved ? '#10b981' : (isUnsaved ? '#F59E0B' : '#334155'),
                              color: '#fff',
                              '&:hover': {
                                background: isSaved ? '#059669' : (isUnsaved ? '#D97706' : '#475569')
                              }
                            }}
                          >
                            {isSaved ? 'Saved' : (isLoading ? 'Saving...' : 'Save')}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {admins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={PERMISSIONS.length + 2} align="center" sx={{ py: 4, color: '#94A3B8' }}>
                      No administrators found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
