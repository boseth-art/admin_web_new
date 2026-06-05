import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, TextField,
  InputAdornment, IconButton, Tooltip, Grid, CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import InboxIcon from '@mui/icons-material/Inbox';
import { db } from '../data/firebase';
import { collection, getDocs } from 'firebase/firestore';

const STATUS = {
  active:    { label: 'Active',    bg: 'rgba(52,211,153,0.1)',  color: '#34D399', border: 'rgba(52,211,153,0.2)'  },
  inactive:  { label: 'Inactive',  bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: 'rgba(100,116,139,0.2)' },
  suspended: { label: 'Suspended', bg: 'rgba(248,113,113,0.1)', color: '#F87171', border: 'rgba(248,113,113,0.2)' },
};

const PLAN = {
  Free:       { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: 'rgba(100,116,139,0.2)' },
  Premium:    { bg: 'rgba(45,212,191,0.1)',  color: '#2DD4BF', border: 'rgba(45,212,191,0.2)'  },
  Enterprise: { bg: 'rgba(99,102,241,0.1)',  color: '#818CF8', border: 'rgba(99,102,241,0.2)'  },
};

const AVATAR_COLORS = ['#2DD4BF','#6366F1','#34D399','#FBBF24','#F472B6','#FB923C','#A78BFA','#38BDF8'];

export default function UsersPage() {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const list = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id:           doc.id,
            name:         data.name         || 'Anonymous User',
            email:        data.email        || '',
            plan:         data.plan         || 'Free',
            balance:      typeof data.balance      === 'number' ? data.balance      : Number(data.balance      || 0),
            transactions: typeof data.transactions === 'number' ? data.transactions : Number(data.transactions || 0),
            joined:       data.joined       || '',
            status:       data.status       || 'active',
          };
        });
        setUsers(list);
      } catch (err) {
        console.error('[FinGuard] Error loading users from Firestore:', err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '70vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalUsers     = users.length;
  const activeCount    = users.filter(u => u.status === 'active').length;
  const premiumCount   = users.filter(u => u.plan === 'Premium').length;
  const suspendedCount = users.filter(u => u.status === 'suspended').length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Users</Typography>
          <Typography sx={{ color: '#64748B', mt: 0.5 }}>{filtered.length} registered users</Typography>
        </Box>
        <Chip
          icon={<PersonAddIcon sx={{ fontSize: '16px !important' }} />}
          label="Add User"
          clickable
          sx={{ background: 'linear-gradient(135deg,#2DD4BF,#0D9488)', color: '#0D1B2A', fontWeight: 700, px: 1, py: 2.5, border: 'none', fontSize: '0.85rem' }}
        />
      </Box>

      {/* Summary cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Total Users', value: totalUsers.toLocaleString(),     color: '#2DD4BF' },
          { label: 'Active',      value: activeCount.toLocaleString(),    color: '#34D399' },
          { label: 'Premium',     value: premiumCount.toLocaleString(),   color: '#6366F1' },
          { label: 'Suspended',   value: suspendedCount.toLocaleString(), color: '#F87171' },
        ].map(({ label, value, color }) => (
          <Grid item xs={6} md={3} key={label}>
            <Card elevation={0}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography sx={{ color: '#64748B', fontSize: '0.8rem', mb: 0.5 }}>{label}</Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color }}>{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: '1 1 260px' }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#475569', fontSize: 18 }} /></InputAdornment>,
              }}
            />
            <Tooltip title="Filter">
              <IconButton sx={{ border: '1px solid rgba(45,212,191,0.15)', color: '#64748B', borderRadius: 2 }}>
                <FilterListIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <InboxIcon sx={{ fontSize: 48, color: '#334155', mb: 1.5 }} />
              <Typography sx={{ color: '#475569', fontSize: '0.9rem' }}>
                {search ? 'No users match your search.' : 'No users found in Firestore yet.'}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ background: 'transparent' }}>
              <Table aria-label="users table">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell align="right">Transactions</TableCell>
                    <TableCell>Joined</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(({ id, name, email, plan, balance, transactions, joined, status }, i) => {
                    const s = STATUS[status]  || STATUS.active;
                    const p = PLAN[plan]      || PLAN.Free;
                    return (
                      <TableRow key={id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 36, height: 36, fontSize: '0.85rem', fontWeight: 700, background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                              {name[0]}
                            </Avatar>
                            <Box>
                              <Typography sx={{ color: '#F0F6FF', fontSize: '0.88rem', fontWeight: 600 }}>{name}</Typography>
                              <Typography sx={{ color: '#475569', fontSize: '0.72rem' }}>{email}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={plan} size="small" sx={{ background: p.bg, color: p.color, border: `1px solid ${p.border}`, fontWeight: 600, fontSize: '0.72rem' }} />
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ color: '#F0F6FF', fontWeight: 700, fontSize: '0.88rem' }}>Rs. {balance.toLocaleString()}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ color: '#94A3B8', fontSize: '0.85rem' }}>{transactions}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: '#64748B', fontSize: '0.8rem' }}>{joined}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={s.label} size="small" sx={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600, fontSize: '0.72rem' }} />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" sx={{ color: '#475569', '&:hover': { color: '#2DD4BF' } }}>
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
