import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, CircularProgress,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import InboxIcon from '@mui/icons-material/Inbox';
import { db } from '../data/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ background: 'rgba(13,27,42,0.95)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 2, p: 1.5 }}>
      <Typography sx={{ color: '#94A3B8', fontSize: '0.75rem', mb: 0.5 }}>{label}</Typography>
      {payload.map((p) => (
        <Typography key={p.name} sx={{ color: p.color, fontSize: '0.82rem', fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? `$${(p.value / 1000).toFixed(0)}K` : p.value}
        </Typography>
      ))}
    </Box>
  );
};

function EmptyState({ message }) {
  return (
    <Box sx={{ py: 5, textAlign: 'center' }}>
      <InboxIcon sx={{ fontSize: 40, color: '#334155', mb: 1.5 }} />
      <Typography sx={{ color: '#475569', fontSize: '0.88rem' }}>{message}</Typography>
    </Box>
  );
}

export default function AnalyticsPage() {
  const [revenue, setRevenue]         = useState([]);
  const [spending, setSpending]       = useState([]);
  const [growthData, setGrowthData]   = useState([]);
  const [quickMetrics, setQuickMetrics] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Monthly revenue (for bar chart)
        const revSnap = await getDocs(collection(db, 'monthlyRevenue'));
        setRevenue(revSnap.docs.map(doc => doc.data()));

        // Category spending (for radar)
        const spendSnap = await getDocs(collection(db, 'categorySpending'));
        setSpending(spendSnap.docs.map(doc => doc.data()));

        // User/session growth data
        const growthSnap = await getDocs(
          query(collection(db, 'userGrowth'), orderBy('month', 'asc'), limit(12))
        );
        setGrowthData(growthSnap.docs.map(doc => doc.data()));

        // Quick metrics
        const metricsSnap = await getDocs(collection(db, 'quickMetrics'));
        setQuickMetrics(metricsSnap.docs.map(doc => doc.data()));

      } catch (err) {
        console.error('[FinGuard] Analytics Firestore error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '70vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  // Derive radar data from spending collection
  const radarData = spending.map(({ category, percentage }) => ({
    subject: (category || '').split(' ')[0],
    value:   percentage || 0,
  }));

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Analytics</Typography>
        <Typography sx={{ color: '#64748B', mt: 0.5 }}>Platform performance &amp; financial trends</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* User Growth */}
        <Grid item xs={12} lg={7}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 0.5 }}>User Growth</Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>Monthly active users &amp; sessions</Typography>
              {growthData.length === 0 ? (
                <EmptyState message="No user growth data in Firestore yet. Add documents to the 'userGrowth' collection." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,212,191,0.06)" />
                    <XAxis dataKey="month"    tick={{ fill: '#475569', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis                    tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="users"    name="Users"    stroke="#2DD4BF" strokeWidth={2.5} dot={{ fill: '#2DD4BF', r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#6366F1" strokeWidth={2}   dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Spending Radar */}
        <Grid item xs={12} lg={5}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 0.5 }}>Spending Pattern</Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>Category distribution radar</Typography>
              {radarData.length === 0 ? (
                <EmptyState message="No category spending data in Firestore yet." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(45,212,191,0.1)" />
                    <PolarAngleAxis  dataKey="subject" tick={{ fill: '#64748B', fontSize: 11 }} />
                    <PolarRadiusAxis                   tick={{ fill: '#475569', fontSize: 9  }} />
                    <Radar name="Spending" dataKey="value" stroke="#2DD4BF" fill="#2DD4BF" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Bar Chart */}
        <Grid item xs={12} lg={8}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 0.5 }}>Income vs Expense</Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>Comparison across months</Typography>
              {revenue.length === 0 ? (
                <EmptyState message="No monthly revenue data in Firestore yet." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={revenue} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,212,191,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="income"  name="Income"  fill="#2DD4BF" radius={[4, 4, 0, 0]} maxBarSize={32} fillOpacity={0.9} />
                    <Bar dataKey="expense" name="Expense" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={32} fillOpacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Metrics */}
        <Grid item xs={12} lg={4}>
          <Card elevation={0} sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 3 }}>Quick Metrics</Typography>
              {quickMetrics.length === 0 ? (
                <EmptyState message="No quick metrics in Firestore yet. Add docs to 'quickMetrics' collection." />
              ) : (
                quickMetrics.map(({ label, value, change, up }) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid rgba(45,212,191,0.06)', '&:last-child': { borderBottom: 0 } }}>
                    <Typography sx={{ color: '#94A3B8', fontSize: '0.83rem' }}>{label}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography fontWeight={700} sx={{ color: '#F0F6FF', fontSize: '0.9rem' }}>{value}</Typography>
                      {change !== undefined && (
                        <Typography sx={{ color: up ? '#34D399' : '#F87171', fontSize: '0.72rem', fontWeight: 600 }}>{change}</Typography>
                      )}
                    </Box>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
