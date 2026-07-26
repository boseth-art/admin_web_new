import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, CircularProgress,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import InboxIcon      from '@mui/icons-material/Inbox';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PeopleIcon     from '@mui/icons-material/People';
import PersonAddIcon  from '@mui/icons-material/PersonAdd';
import { db } from '../data/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

/* ─── Helpers ─────────────────────────────────────────────── */
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseDate(raw) {
  if (!raw) return null;
  if (raw?.toDate) return raw.toDate();           // Firestore Timestamp
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d) ? null : d;
  }
  return null;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2,'0')}`;
}
function monthLabel(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/* ─── Tooltip ─────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      background: 'rgba(13,27,42,0.97)',
      border: '1px solid rgba(45,212,191,0.25)',
      borderRadius: 2, p: 1.5, minWidth: 140,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <Typography sx={{ color: '#94A3B8', fontSize: '0.73rem', mb: 0.75, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</Typography>
      {payload.map((p) => (
        <Box key={p.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <Typography sx={{ color: '#CBD5E1', fontSize: '0.8rem' }}>
            {p.name}:&nbsp;
            <span style={{ color: p.color, fontWeight: 700 }}>
              {typeof p.value === 'number' && p.value > 100
                ? `Rs. ${p.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : p.value}
            </span>
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

const UserGrowthTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      background: 'rgba(13,27,42,0.97)',
      border: '1px solid rgba(99,102,241,0.35)',
      borderRadius: 2, p: 1.5, minWidth: 180,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <Typography sx={{ color: '#94A3B8', fontSize: '0.73rem', mb: 0.75, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</Typography>
      {payload.map((p) => (
        <Box key={p.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <Typography sx={{ color: '#CBD5E1', fontSize: '0.8rem' }}>
            {p.name}:&nbsp;
            <span style={{ color: p.color, fontWeight: 700 }}>{p.value}</span>
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

function EmptyState({ message }) {
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <InboxIcon sx={{ fontSize: 44, color: '#1E293B', mb: 1.5 }} />
      <Typography sx={{ color: '#475569', fontSize: '0.88rem' }}>{message}</Typography>
    </Box>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 0.4 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: '#64748B' }}>{subtitle}</Typography>
    </Box>
  );
}

/* ─── Main ────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [userGrowthData,  setUserGrowthData]  = useState([]);
  const [monthlyData,     setMonthlyData]     = useState([]);
  const [categoryData,    setCategoryData]    = useState([]);
  const [quickMetrics,    setQuickMetrics]    = useState(null);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // ── Fetch Users ──────────────────────────────────────
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(doc => {
          const d = doc.data();
          return {
            date:   parseDate(d.createdAt) || parseDate(d.joined),
            status: d.status || 'active',
            role:   d.role   || 'Unknown',
          };
        });

        // Group users by month → new signups + cumulative total
        const userMonthMap = {};
        users.forEach(({ date }) => {
          if (!date) return;
          const key   = monthKey(date);
          const label = monthLabel(date);
          if (!userMonthMap[key]) userMonthMap[key] = { key, month: label, newUsers: 0, totalUsers: 0 };
          userMonthMap[key].newUsers += 1;
        });
        // Build cumulative total
        let cumulative = 0;
        const userGrowth = Object.keys(userMonthMap).sort().map(k => {
          cumulative += userMonthMap[k].newUsers;
          return { ...userMonthMap[k], totalUsers: cumulative };
        });
        setUserGrowthData(userGrowth);

        // ── Fetch Transactions ───────────────────────────────
        const txSnap = await getDocs(
          query(collection(db, 'transactions'), orderBy('date', 'asc'))
        );
        const txns = txSnap.docs.map(doc => {
          const d = doc.data();
          return {
            amount:   typeof d.amount === 'number' ? d.amount : Number(d.amount || 0),
            category: d.category || 'Other',
            date:     parseDate(d.date),
            status:   d.status || 'completed',
          };
        });

        // Monthly income vs expense
        const monthMap = {};
        txns.forEach(({ amount, date }) => {
          if (!date) return;
          const key   = monthKey(date);
          const label = monthLabel(date);
          if (!monthMap[key]) monthMap[key] = { month: label, income: 0, expense: 0 };
          if (amount >= 0) monthMap[key].income  += amount;
          else             monthMap[key].expense += Math.abs(amount);
        });
        setMonthlyData(Object.keys(monthMap).sort().map(k => monthMap[k]));

        // Category radar
        const catMap = {};
        txns.forEach(({ amount, category }) => {
          if (amount < 0) catMap[category] = (catMap[category] || 0) + Math.abs(amount);
        });
        const totalSpend = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
        setCategoryData(
          Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,8).map(([cat, val]) => ({
            subject: cat.split(' ')[0],
            value:   Math.round((val / totalSpend) * 100),
          }))
        );

        // Quick metrics
        const totalIncome  = txns.filter(t => t.amount > 0).reduce((a,t) => a + t.amount, 0);
        const totalExpense = txns.filter(t => t.amount < 0).reduce((a,t) => a + Math.abs(t.amount), 0);
        const activeUsers  = users.filter(u => u.status === 'active').length;
        const completed    = txns.filter(t => t.status === 'completed').length;
        const successRate  = txns.length ? Math.round((completed / txns.length) * 100) : 0;

        setQuickMetrics([
          { label: 'Total Users',    value: users.length,                                       color: '#6366F1', Icon: PeopleIcon              },
          { label: 'Active Users',   value: activeUsers,                                        color: '#34D399', Icon: PersonAddIcon            },
          { label: 'Total Income',   value: `Rs. ${totalIncome.toLocaleString()}`,              color: '#2DD4BF', Icon: TrendingUpIcon           },
          { label: 'Total Expense',  value: `Rs. ${totalExpense.toLocaleString()}`,             color: '#F87171', Icon: TrendingDownIcon         },
          { label: 'Net Balance',    value: `Rs. ${(totalIncome-totalExpense).toLocaleString()}`, color: '#A78BFA', Icon: AccountBalanceWalletIcon },
          { label: 'Success Rate',   value: `${successRate}%`,                                  color: '#FBBF24', Icon: TrendingUpIcon           },
        ]);

      } catch (err) {
        console.error('[FinGuard] Analytics error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '70vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
        <CircularProgress sx={{ color: '#6366F1' }} size={44} />
        <Typography sx={{ color: '#475569', fontSize: '0.88rem' }}>Loading analytics…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Analytics</Typography>
        <Typography sx={{ color: '#64748B', mt: 0.5 }}>Platform performance &amp; financial trends</Typography>
      </Box>

      {/* Quick Metrics */}
      {quickMetrics && (
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {quickMetrics.map(({ label, value, color, Icon }) => (
            <Grid item xs={6} sm={4} md={2} key={label}>
              <Card elevation={0} sx={{ height: '100%' }}>
                <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: 2, flexShrink: 0,
                    background: `${color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon sx={{ color, fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#64748B', fontSize: '0.72rem', mb: 0.25 }}>{label}</Typography>
                    <Typography fontWeight={800} sx={{ color: '#F0F6FF', fontSize: '0.88rem', lineHeight: 1.2 }}>{value}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Grid container spacing={3}>

        {/* ── USER GROWTH (full width, hero chart) ─────────── */}
        <Grid item xs={12}>
          <Card elevation={0} sx={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(45,212,191,0.04) 100%)',
            border: '1px solid rgba(99,102,241,0.18)',
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: 2, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PeopleIcon sx={{ color: '#6366F1', fontSize: 20 }} />
                    </Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF' }}>User Growth</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#64748B', ml: 6.5 }}>
                    New sign-ups per month &amp; cumulative total users over time
                  </Typography>
                </Box>
                {/* Summary badges */}
                {userGrowthData.length > 0 && (() => {
                  const last      = userGrowthData[userGrowthData.length - 1];
                  const prev      = userGrowthData[userGrowthData.length - 2];
                  const change    = prev ? last.newUsers - prev.newUsers : null;
                  const pct       = prev && prev.newUsers > 0
                    ? ((change / prev.newUsers) * 100).toFixed(0)
                    : null;
                  return (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ color: '#64748B', fontSize: '0.72rem', mb: 0.25 }}>Total Users</Typography>
                        <Typography fontWeight={800} sx={{ color: '#6366F1', fontSize: '1.3rem' }}>{last.totalUsers}</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ color: '#64748B', fontSize: '0.72rem', mb: 0.25 }}>This Month</Typography>
                        <Typography fontWeight={800} sx={{ color: '#2DD4BF', fontSize: '1.3rem' }}>
                          +{last.newUsers}
                          {pct !== null && (
                            <Typography component="span" sx={{ color: Number(pct) >= 0 ? '#34D399' : '#F87171', fontSize: '0.72rem', ml: 0.75 }}>
                              ({Number(pct) >= 0 ? '+' : ''}{pct}%)
                            </Typography>
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })()}
              </Box>

              {userGrowthData.length === 0 ? (
                <EmptyState message="No users found in Firestore yet." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={userGrowthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2DD4BF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2DD4BF" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={false} tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      yAxisId="total"
                      orientation="right"
                      tick={{ fill: '#6366F1', fontSize: 11 }}
                      axisLine={false} tickLine={false}
                      label={{ value: 'Total Users', angle: 90, position: 'insideRight', fill: '#6366F1', fontSize: 11, dx: 16 }}
                    />
                    <YAxis
                      yAxisId="new"
                      orientation="left"
                      tick={{ fill: '#2DD4BF', fontSize: 11 }}
                      axisLine={false} tickLine={false}
                      label={{ value: 'New Users', angle: -90, position: 'insideLeft', fill: '#2DD4BF', fontSize: 11, dx: -4 }}
                    />
                    <Tooltip content={<UserGrowthTooltip />} />
                    <Legend
                      wrapperStyle={{ color: '#64748B', fontSize: '0.8rem', paddingTop: 12 }}
                      formatter={(val) => <span style={{ color: val === 'Total Users' ? '#6366F1' : '#2DD4BF' }}>{val}</span>}
                    />
                    <Area
                      yAxisId="total"
                      type="monotone"
                      dataKey="totalUsers"
                      name="Total Users"
                      stroke="#6366F1"
                      strokeWidth={2.5}
                      fill="url(#gradTotal)"
                      dot={{ fill: '#6366F1', r: 4, strokeWidth: 2, stroke: '#0F172A' }}
                      activeDot={{ r: 7, fill: '#6366F1', stroke: '#0F172A', strokeWidth: 2 }}
                    />
                    <Area
                      yAxisId="new"
                      type="monotone"
                      dataKey="newUsers"
                      name="New Users"
                      stroke="#2DD4BF"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      fill="url(#gradNew)"
                      dot={{ fill: '#2DD4BF', r: 4, strokeWidth: 2, stroke: '#0F172A' }}
                      activeDot={{ r: 7, fill: '#2DD4BF', stroke: '#0F172A', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Income vs Expense Bar Chart ───────────────────── */}
        <Grid item xs={12} lg={7}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeading title="Income vs Expense" subtitle="Monthly comparison across all transactions" />
              {monthlyData.length === 0 ? (
                <EmptyState message="No transactions found in Firestore yet." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,212,191,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `Rs.${(v/1000).toFixed(0)}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: '#64748B', fontSize: '0.78rem', paddingTop: 8 }} />
                    <Bar dataKey="income"  name="Income"  fill="#2DD4BF" radius={[4,4,0,0]} maxBarSize={32} fillOpacity={0.9} />
                    <Bar dataKey="expense" name="Expense" fill="#6366F1" radius={[4,4,0,0]} maxBarSize={32} fillOpacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Spending Radar ────────────────────────────────── */}
        <Grid item xs={12} lg={5}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeading title="Spending Pattern" subtitle="Category distribution (% of total expenses)" />
              {categoryData.length === 0 ? (
                <EmptyState message="No expense transactions found to build radar chart." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={categoryData}>
                    <PolarGrid stroke="rgba(45,212,191,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fill: '#475569', fontSize: 9 }} tickFormatter={v => `${v}%`} />
                    <Radar name="Spending %" dataKey="value" stroke="#2DD4BF" fill="#2DD4BF" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </Box>
  );
}
