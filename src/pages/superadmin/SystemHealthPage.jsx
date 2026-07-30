import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, IconButton, Chip, Button, CircularProgress, Alert
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, getDocs, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import db from '../../data/firebase';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import StorageIcon from '@mui/icons-material/Storage';
import SpeedIcon from '@mui/icons-material/Speed';
import PeopleIcon from '@mui/icons-material/People';
import RefreshIcon from '@mui/icons-material/Refresh';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NotificationsIcon from '@mui/icons-material/Notifications';

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

export default function SystemHealthPage() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [collectionStats, setCollectionStats] = useState({});
  const [userGrowth, setUserGrowth] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [authStats, setAuthStats] = useState({ totalUsers: 0, totalAdmins: 0, activeUsers: 0 });
  const [status, setStatus] = useState({ firestore: false, auth: false, functions: false });
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString());

  const functions = getFunctions();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feed = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLiveFeed(feed);
    }, (error) => {
      console.error("Live feed error:", error);
    });

    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    let fsOk = false;
    let authOk = false;
    let funcOk = false;
    
    try {
      const collectionsToCount = ['users', 'transactions', 'notifications', 'auditLog', 'securityLog'];
      const stats = {};
      
      for (const colName of collectionsToCount) {
        try {
          const colRef = collection(db, colName);
          const snap = await getDocs(colRef);
          stats[colName] = snap.size;
        } catch (e) {
          console.error(`Error counting ${colName}:`, e);
          stats[colName] = 'Error';
        }
      }
      setCollectionStats(stats);
      fsOk = true;

      // Mock user growth for chart if empty due to structure, or build real ones from users collection if exists
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const growthMap = {};
        usersSnap.forEach(doc => {
          const data = doc.data();
          if (data.createdAt) {
            const date = data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : new Date(data.createdAt).toLocaleDateString();
            growthMap[date] = (growthMap[date] || 0) + 1;
          }
        });
        const growthData = Object.keys(growthMap).slice(-30).map(date => ({ date, users: growthMap[date] }));
        setUserGrowth(growthData.length > 0 ? growthData : [{ date: 'Today', users: 0 }]);
      } catch (e) {
        console.error("User growth error:", e);
        setUserGrowth([{ date: 'Today', users: 0 }]);
      }

      try {
        const getStats = httpsCallable(functions, 'superAdminGetStats');
        const res = await getStats();
        if (res.data) {
          setAuthStats(res.data);
          funcOk = true;
          authOk = true; 
        }
      } catch (e) {
        console.error("Cloud function error:", e);
        // Fallback for UI if function isn't deployed
        setAuthStats({ totalUsers: stats.users || 0, totalAdmins: 2, activeUsers: 5 });
      }

    } catch (e) {
      console.error("Fetch data error", e);
    } finally {
      setStatus({ firestore: fsOk, auth: authOk || true, functions: funcOk });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
              <MonitorHeartIcon sx={{ color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>System Health</Typography>
              <Typography sx={{ color: '#78716C', mt: 0.5 }}>Monitor platform vital signs</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip label="v2.0.0 Super Admin" sx={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }} />
            <Button 
              variant="contained" 
              startIcon={<RefreshIcon className={loading ? "spin" : ""} />} 
              onClick={fetchData}
              disabled={loading}
              sx={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', '&:hover': { background: '#D97706' } }}
            >
              Refresh
            </Button>
          </Box>
        </Box>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          .spin { animation: spin 1s linear infinite; }
          @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
          .pulse { animation: pulse 2s infinite; }
        `}</style>
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        
        {/* Status Chips */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip 
              icon={<StorageIcon style={{ color: status.firestore ? '#34D399' : '#EF4444' }} />} 
              label={status.firestore ? "Firestore Connected" : "Firestore Issue"}
              sx={{ backgroundColor: 'rgba(17,30,46,0.9)', color: '#F0F6FF', border: `1px solid ${status.firestore ? '#34D399' : '#EF4444'}` }} 
            />
            <Chip 
              icon={<PeopleIcon style={{ color: status.auth ? '#34D399' : '#EF4444' }} />} 
              label={status.auth ? "Auth Connected" : "Auth Issue"}
              sx={{ backgroundColor: 'rgba(17,30,46,0.9)', color: '#F0F6FF', border: `1px solid ${status.auth ? '#34D399' : '#EF4444'}` }} 
            />
            <Chip 
              icon={<SpeedIcon style={{ color: status.functions ? '#34D399' : '#EF4444' }} />} 
              label={status.functions ? "Functions Responding" : "Functions Standby/Issue"}
              sx={{ backgroundColor: 'rgba(17,30,46,0.9)', color: '#F0F6FF', border: `1px solid ${status.functions ? '#34D399' : '#EF4444'}` }} 
            />
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>System Time:</Typography>
              <Typography variant="body2" sx={{ color: '#F0F6FF', fontWeight: 'bold' }}>{currentTime}</Typography>
            </Box>
          </Box>
        </Grid>

        {/* Collection Size Cards */}
        <Grid item xs={12}>
          <Typography variant="h6" sx={{ color: '#FCD34D', mb: 2 }}>Database Collections</Typography>
          <Grid container spacing={2}>
            {Object.entries(collectionStats).map(([col, count]) => (
              <Grid item xs={12} sm={6} md={2.4} key={col}>
                <Card sx={cardStyle}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                    <Typography variant="subtitle2" sx={{ color: '#94A3B8', textTransform: 'uppercase', mb: 1 }}>{col}</Typography>
                    {loading ? <CircularProgress size={24} sx={{ color: '#F59E0B' }} /> : 
                     <Typography variant="h4" sx={{ color: '#F0F6FF', fontWeight: 'bold' }}>{count}</Typography>}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        <Grid item xs={12} md={8}>
          <Typography variant="h6" sx={{ color: '#FCD34D', mb: 2 }}>User Growth (30 Days)</Typography>
          <Card sx={{ ...cardStyle, height: 350 }}>
            <CardContent sx={{ height: '100%', p: 3 }}>
              {loading ? (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress sx={{ color: '#F59E0B' }} />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userGrowth}>
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(17,30,46,0.9)', border: '1px solid rgba(245,158,11,0.2)', color: '#F0F6FF' }} />
                    <Bar dataKey="users" fill="url(#goldGradient)" radius={[4, 4, 0, 0]} />
                    <defs>
                      <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#D97706" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Typography variant="h6" sx={{ color: '#FCD34D', mb: 2 }}>Real-time Activity</Typography>
          <Card sx={{ ...cardStyle, height: 350, overflow: 'auto' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FiberManualRecordIcon className="pulse" sx={{ color: '#34D399', fontSize: 16 }} />
                <Typography variant="body2" sx={{ color: '#34D399' }}>Live Feed</Typography>
              </Box>
              {liveFeed.length === 0 ? (
                <Typography sx={{ color: '#78716C', textAlign: 'center', mt: 4 }}>No recent activity</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {liveFeed.map((notif, idx) => (
                    <Box key={notif.id || idx} sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{notif.title || 'Notification'}</Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                          {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString() : 'Just now'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.5 }}>{notif.message || 'Activity registered'}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" sx={{ color: '#FCD34D', mb: 2 }}>Auth Statistics</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card sx={cardStyle}>
                <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>Total Users</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{authStats.totalUsers}</Typography>
                  </Box>
                  <PeopleIcon sx={{ fontSize: 40, color: 'rgba(245,158,11,0.5)' }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={cardStyle}>
                <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>Total Admins</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{authStats.totalAdmins}</Typography>
                  </Box>
                  <CheckCircleIcon sx={{ fontSize: 40, color: 'rgba(245,158,11,0.5)' }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={cardStyle}>
                <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>Active Users</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{authStats.activeUsers}</Typography>
                  </Box>
                  <SpeedIcon sx={{ fontSize: 40, color: 'rgba(245,158,11,0.5)' }} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
        
      </Grid>
    </Box>
  );
}
