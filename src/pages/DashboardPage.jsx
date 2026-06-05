import { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress, Paper, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import RefreshIcon from '@mui/icons-material/Refresh';
import InboxIcon from '@mui/icons-material/Inbox';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { db } from '../data/firebase';
import { collection, getDocs, limit, query, orderBy } from 'firebase/firestore';

/* ─── Stat Card ─────────────────────────────────── */
function StatCard({ icon, label, value, change, color, gradient }) {
  const isUp = change >= 0;
  return (
    <Card elevation={0} sx={{ position: 'relative', overflow: 'hidden' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{
            width: 46, height: 46, borderRadius: 2.5,
            background: `${color}18`, border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color,
          }}>
            {icon}
          </Box>
          {change !== null && (
            <Chip
              icon={isUp ? <TrendingUpIcon sx={{ fontSize: '14px !important' }} /> : <TrendingDownIcon sx={{ fontSize: '14px !important' }} />}
              label={`${Math.abs(change)}%`}
              size="small"
              sx={{
                background: isUp ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                color: isUp ? '#34D399' : '#F87171',
                fontWeight: 700, fontSize: '0.72rem',
                border: `1px solid ${isUp ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          )}
        </Box>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em', mb: 0.3 }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B' }}>{label}</Typography>
        <Box sx={{ mt: 2, height: 3, borderRadius: 2, background: 'rgba(45,212,191,0.08)' }}>
          <Box sx={{ height: '100%', width: '60%', maxWidth: '100%', borderRadius: 2, background: gradient }} />
        </Box>
      </CardContent>
    </Card>
  );
}

/* ─── Empty state ────────────────────────────────── */
function EmptyState({ message }) {
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <InboxIcon sx={{ fontSize: 48, color: '#334155', mb: 1.5 }} />
      <Typography sx={{ color: '#475569', fontSize: '0.9rem' }}>{message}</Typography>
    </Box>
  );
}

const STATUS_COLORS = {
  completed: { label: 'Completed', bg: 'rgba(52,211,153,0.1)', color: '#34D399', border: 'rgba(52,211,153,0.2)' },
  pending:   { label: 'Pending',   bg: 'rgba(251,191,36,0.1)', color: '#FBBF24', border: 'rgba(251,191,36,0.2)' },
  failed:    { label: 'Failed',    bg: 'rgba(248,113,113,0.1)', color: '#F87171', border: 'rgba(248,113,113,0.2)' },
};

const CHART_COLORS = ['#2DD4BF', '#6366F1', '#34D399'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ background: 'rgba(13,27,42,0.95)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 2, p: 1.5, backdropFilter: 'blur(10px)' }}>
      <Typography sx={{ color: '#94A3B8', fontSize: '0.75rem', mb: 0.5 }}>{label}</Typography>
      {payload.map((p) => (
        <Typography key={p.name} sx={{ color: p.color, fontSize: '0.82rem', fontWeight: 600 }}>
          {p.name}: ${(p.value / 1000).toFixed(0)}K
        </Typography>
      ))}
    </Box>
  );
};

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats]           = useState({ totalUsers: 0, totalTransactions: 0, activeAlerts: 0, appSessions: 0 });
  const [revenue, setRevenue]       = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activity, setActivity]     = useState([]);
  const [spending, setSpending]     = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // 1. User & transaction counts
        const usersSnap = await getDocs(collection(db, 'users'));
        const txnsSnap  = await getDocs(collection(db, 'transactions'));

        setStats({
          totalUsers:        usersSnap.size,
          totalTransactions: txnsSnap.size,
          activeAlerts:      0,
          appSessions:       0,
        });

        // 2. Recent transactions (latest 8)
        const txnsQuery   = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(8));
        const liveTxnsSnap = await getDocs(txnsQuery);
        setTransactions(
          liveTxnsSnap.docs.map(doc => {
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
          })
        );

        // 3. Activity log
        const actSnap = await getDocs(
          query(collection(db, 'activityLog'), orderBy('timestamp', 'desc'), limit(6))
        );
        setActivity(actSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // 4. Monthly revenue chart
        const revSnap = await getDocs(collection(db, 'monthlyRevenue'));
        setRevenue(revSnap.docs.map(doc => doc.data()));

        // 5. User distribution (plan breakdown)
        const distSnap = await getDocs(collection(db, 'userDistribution'));
        setDistribution(distSnap.docs.map(doc => doc.data()));

        // 6. Category spending
        const spendSnap = await getDocs(collection(db, 'categorySpending'));
        setSpending(spendSnap.docs.map(doc => doc.data()));

      } catch (err) {
        console.error('[FinGuard] Dashboard Firestore error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [refreshKey]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '70vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>
            Dashboard Overview
          </Typography>
          <Typography sx={{ color: '#64748B', mt: 0.5 }}>
            Welcome back, Administrator 👋
          </Typography>
        </Box>
        <Tooltip title="Refresh data">
          <IconButton onClick={() => setRefreshKey(k => k + 1)} sx={{ border: '1px solid rgba(45,212,191,0.2)', color: '#2DD4BF', '&:hover': { background: 'rgba(45,212,191,0.08)' } }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ─── KPI Cards ─── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { icon: <PeopleIcon />,       label: 'Total Users',        value: stats.totalUsers.toLocaleString(),        change: null, color: '#2DD4BF', gradient: 'linear-gradient(90deg,#2DD4BF,#0D9488)' },
          { icon: <AttachMoneyIcon />,  label: 'Total Transactions', value: stats.totalTransactions.toLocaleString(), change: null, color: '#34D399', gradient: 'linear-gradient(90deg,#34D399,#059669)' },
          { icon: <WarningAmberIcon />, label: 'Active Alerts',      value: stats.activeAlerts,                        change: null, color: '#FBBF24', gradient: 'linear-gradient(90deg,#FBBF24,#D97706)' },
          { icon: <PhoneAndroidIcon />, label: 'App Sessions',       value: stats.appSessions.toLocaleString(),        change: null, color: '#A78BFA', gradient: 'linear-gradient(90deg,#A78BFA,#7C3AED)' },
        ].map((s) => (
          <Grid item xs={12} sm={6} xl={3} key={s.label}>
            <StatCard {...s} />
          </Grid>
        ))}
      </Grid>

      {/* ─── Charts Row ─── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Revenue Area Chart */}
        <Grid item xs={12} lg={8}>
          <Card elevation={0} sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 0.5 }}>Monthly Revenue</Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>Transaction volume over time</Typography>
              {revenue.length === 0 ? (
                <EmptyState message="No monthly revenue data in Firestore yet." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={revenue} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2DD4BF" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2DD4BF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,212,191,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="income"  name="Income"  stroke="#2DD4BF" strokeWidth={2.5} fill="url(#incomeGrad)"  dot={false} activeDot={{ r: 5, fill: '#2DD4BF' }} />
                    <Area type="monotone" dataKey="expense" name="Expense" stroke="#6366F1" strokeWidth={2}   fill="url(#expenseGrad)" dot={false} activeDot={{ r: 5, fill: '#6366F1' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Donut Chart */}
        <Grid item xs={12} lg={4}>
          <Card elevation={0} sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 0.5 }}>User Distribution</Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>By subscription plan</Typography>
              {distribution.length === 0 ? (
                <EmptyState message="No plan distribution data yet." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={distribution} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={4}>
                        {distribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(v) => `${v}%`} contentStyle={{ background: 'rgba(13,27,42,0.95)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {distribution.map(({ name, value }, i) => (
                      <Box key={name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <Typography sx={{ color: '#94A3B8', fontSize: '0.82rem' }}>{name}</Typography>
                        </Box>
                        <Typography fontWeight={700} sx={{ color: '#F0F6FF', fontSize: '0.82rem' }}>{value}%</Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ─── Category Spending + Activity ─── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={5}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 0.5 }}>Spending by Category</Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>Total tracked across all users</Typography>
              {spending.length === 0 ? (
                <EmptyState message="No category spending data yet." />
              ) : (
                spending.map(({ category, amount, percentage }, i) => {
                  const colors = ['#2DD4BF', '#6366F1', '#34D399', '#FBBF24', '#F472B6', '#FB923C'];
                  return (
                    <Box key={category} sx={{ mb: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
                        <Typography sx={{ color: '#94A3B8', fontSize: '0.83rem', fontWeight: 500 }}>{category}</Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography sx={{ color: '#64748B', fontSize: '0.78rem' }}>${(amount / 1000).toFixed(0)}K</Typography>
                          <Typography sx={{ color: colors[i % colors.length], fontSize: '0.78rem', fontWeight: 700 }}>{percentage}%</Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        sx={{ '& .MuiLinearProgress-bar': { background: colors[i % colors.length] } }}
                      />
                    </Box>
                  );
                })
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Activity Feed */}
        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 0.5 }}>System Activity</Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>Latest events and alerts</Typography>
              {activity.length === 0 ? (
                <EmptyState message="No activity log entries yet." />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {activity.map(({ message, time, color }, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 2, pb: 2.5, position: 'relative', '&:not(:last-child)::before': { content: '""', position: 'absolute', left: 7, top: 18, bottom: 0, width: 1, background: 'rgba(45,212,191,0.08)' } }}>
                      <Box sx={{ width: 15, height: 15, borderRadius: '50%', background: color || '#2DD4BF', border: `2px solid ${color || '#2DD4BF'}40`, flexShrink: 0, mt: 0.3 }} />
                      <Box>
                        <Typography sx={{ color: '#CBD5E1', fontSize: '0.85rem', lineHeight: 1.5 }}>{message}</Typography>
                        <Typography sx={{ color: '#475569', fontSize: '0.75rem', mt: 0.3 }}>{time}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ─── Recent Transactions Table ─── */}
      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF' }}>Recent Transactions</Typography>
              <Typography variant="body2" sx={{ color: '#64748B' }}>Latest financial activities across all users</Typography>
            </Box>
            <Chip label="View All →" clickable size="small" sx={{ color: '#2DD4BF', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', fontWeight: 600 }} />
          </Box>
          {transactions.length === 0 ? (
            <EmptyState message="No transactions found in Firestore." />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ background: 'transparent' }}>
              <Table aria-label="recent transactions table">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map(({ id, user, email, category, amount, date, status, avatar }) => {
                    const s = STATUS_COLORS[status] || STATUS_COLORS.completed;
                    return (
                      <TableRow key={id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 32, height: 32, fontSize: '0.78rem', fontWeight: 700, background: 'linear-gradient(135deg,#2DD4BF,#6366F1)' }}>{avatar}</Avatar>
                            <Box>
                              <Typography sx={{ color: '#F0F6FF', fontSize: '0.85rem', fontWeight: 600 }}>{user}</Typography>
                              <Typography sx={{ color: '#475569', fontSize: '0.72rem' }}>{email}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell><Typography sx={{ color: '#94A3B8', fontSize: '0.83rem' }}>{category}</Typography></TableCell>
                        <TableCell align="right">
                          <Typography sx={{ color: amount >= 0 ? '#34D399' : '#F87171', fontWeight: 700, fontSize: '0.88rem' }}>
                            {amount >= 0 ? '+' : ''}{amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography sx={{ color: '#64748B', fontSize: '0.8rem' }}>{date}</Typography></TableCell>
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
