import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Avatar,
  TextField, InputAdornment, Grid, CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import DownloadIcon from '@mui/icons-material/Download';
import InboxIcon from '@mui/icons-material/Inbox';
import { db } from '../data/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

const STATUS_COLORS = {
  completed: { label: 'Completed', bg: 'rgba(52,211,153,0.1)',  color: '#34D399', border: 'rgba(52,211,153,0.2)'  },
  pending:   { label: 'Pending',   bg: 'rgba(251,191,36,0.1)',  color: '#FBBF24', border: 'rgba(251,191,36,0.2)'  },
  failed:    { label: 'Failed',    bg: 'rgba(248,113,113,0.1)', color: '#F87171', border: 'rgba(248,113,113,0.2)' },
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('All');

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(
          query(collection(db, 'transactions'), orderBy('date', 'desc'))
        );
        const list = querySnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id:       doc.id,
            user:     d.user     || 'Unknown User',
            email:    d.email    || '',
            category: d.category || 'Uncategorized',
            amount:   typeof d.amount === 'number' ? d.amount : Number(d.amount || 0),
            date:     d.date     || '',
            status:   d.status   || 'completed',
            avatar:   d.avatar   || (d.user ? d.user.charAt(0) : 'U'),
          };
        });
        setTransactions(list);
      } catch (err) {
        console.error('[FinGuard] Error loading transactions from Firestore:', err);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '70vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const filtered = transactions.filter(t => {
    const matchSearch = t.user.toLowerCase().includes(search.toLowerCase()) ||
                        t.category.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || t.status === filter.toLowerCase();
    return matchSearch && matchFilter;
  });

  const totalIncome  = transactions.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const totalExpense = transactions.filter(t => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Transactions</Typography>
          <Typography sx={{ color: '#64748B', mt: 0.5 }}>All financial activities across the platform</Typography>
        </Box>
        <Chip
          icon={<DownloadIcon sx={{ fontSize: '16px !important' }} />}
          label="Export CSV"
          clickable
          sx={{ background: 'rgba(45,212,191,0.1)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.2)', fontWeight: 600, px: 1, py: 2.5 }}
        />
      </Box>

      {/* Summary */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Total Income',  value: `+Rs. ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <TrendingUpIcon />,   color: '#34D399' },
          { label: 'Total Expense', value: `-Rs. ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <TrendingDownIcon />, color: '#F87171' },
          { label: 'Net Flow',      value: `${(totalIncome - totalExpense) >= 0 ? '+' : '-'}Rs. ${Math.abs(totalIncome - totalExpense).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <TrendingUpIcon />,   color: '#2DD4BF' },
          { label: 'Total Count',   value: transactions.length,                         icon: null,                color: '#A78BFA' },
        ].map(({ label, value, color }) => (
          <Grid item xs={6} md={3} key={label}>
            <Card elevation={0}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography sx={{ color: '#64748B', fontSize: '0.8rem', mb: 0.5 }}>{label}</Typography>
                <Typography variant="h6" fontWeight={800} sx={{ color }}>{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: '1 1 240px' }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#475569', fontSize: 18 }} /></InputAdornment> }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              {['All', 'Completed', 'Pending', 'Failed'].map(f => (
                <Chip
                  key={f} label={f} size="small" clickable
                  onClick={() => setFilter(f)}
                  sx={{
                    background: filter === f ? 'rgba(45,212,191,0.15)' : 'transparent',
                    color: filter === f ? '#2DD4BF' : '#64748B',
                    border: `1px solid ${filter === f ? 'rgba(45,212,191,0.3)' : 'rgba(100,116,139,0.2)'}`,
                    fontWeight: 600,
                  }}
                />
              ))}
            </Box>
          </Box>

          {filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <InboxIcon sx={{ fontSize: 48, color: '#334155', mb: 1.5 }} />
              <Typography sx={{ color: '#475569', fontSize: '0.9rem' }}>
                {search || filter !== 'All'
                  ? 'No transactions match your filters.'
                  : 'No transactions found in Firestore yet.'}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ background: 'transparent' }}>
              <Table aria-label="transactions table">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(({ id, user, avatar, category, amount, date, status }) => {
                    const s = STATUS_COLORS[status] || STATUS_COLORS.completed;
                    return (
                      <TableRow key={id}>
                        <TableCell>
                          <Typography sx={{ color: '#475569', fontSize: '0.78rem', fontFamily: 'monospace' }}>{id}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 30, height: 30, fontSize: '0.72rem', fontWeight: 700, background: 'linear-gradient(135deg,#2DD4BF,#6366F1)' }}>{avatar}</Avatar>
                            <Typography sx={{ color: '#F0F6FF', fontSize: '0.85rem', fontWeight: 500 }}>{user}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: '#94A3B8', fontSize: '0.83rem' }}>{category}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ color: amount >= 0 ? '#34D399' : '#F87171', fontWeight: 700, fontSize: '0.88rem' }}>
                            {amount >= 0 ? '+' : '-'}{'Rs. '}{Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: '#64748B', fontSize: '0.8rem' }}>{date}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={s.label} size="small" sx={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600, fontSize: '0.72rem' }} />
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
