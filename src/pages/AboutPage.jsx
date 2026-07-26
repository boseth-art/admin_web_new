import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Container, Typography, Card, CardContent,
  Avatar, Chip, Button, Divider, TextField, CircularProgress, Alert,
} from '@mui/material';
import { motion } from 'framer-motion';
import { db } from '../data/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SavingsIcon from '@mui/icons-material/Savings';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PieChartIcon from '@mui/icons-material/PieChart';
import SyncIcon from '@mui/icons-material/Sync';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GooglePlayIcon from '@mui/icons-material/Shop';

/* ── Team data ─────────────────────────────────── */
const team = [
  {
    name: 'Kawisha Nawanjana',
    role: 'Creative Lead',
    photo: '/images/member1.jpg',
    initials: 'KN',
    color: '#2DD4BF',
    gradient: 'linear-gradient(135deg,#2DD4BF,#0D9488)',
    bio: 'Drives the visual identity and user experience design, ensuring every interface is intuitive and beautiful.',
  },
  {
    name: 'Naveen Geeth',
    role: 'Core Producer',
    photo: '/images/member_naveen.jpg',
    initials: 'NG',
    color: '#6366F1',
    gradient: 'linear-gradient(135deg,#6366F1,#4338CA)',
    bio: 'Oversees production pipelines and ensures all deliverables meet quality standards on time and within scope.',
  },
  {
    name: 'Boseth Rathnayake',
    role: 'Project Manager',
    photo: '/images/member_boseth.jpg',
    initials: 'BR',
    color: '#FBBF24',
    gradient: 'linear-gradient(135deg,#FBBF24,#D97706)',
    bio: 'Leads the team strategy, coordinates cross-functional efforts, and keeps the project on track from concept to launch.',
  },
  {
    name: 'Dinura Bhanuka',
    role: 'QA Engineer',
    photo: '/images/member3.jpg',
    initials: 'DB',
    color: '#34D399',
    gradient: 'linear-gradient(135deg,#34D399,#059669)',
    bio: 'Ensures software reliability through rigorous testing, bug tracking, and quality assurance processes.',
  },
  {
    name: 'Dulani Sahanya',
    role: 'Core Producer',
    photo: '/images/member2.jpg',
    initials: 'DS',
    color: '#F472B6',
    gradient: 'linear-gradient(135deg,#F472B6,#BE185D)',
    bio: 'Manages content production, coordinates feature rollouts, and bridges the gap between design and development.',
  },
];

/* ── App features ──────────────────────────────── */
const features = [
  { icon: <BarChartIcon fontSize="large" />, title: 'Real-time Analytics', desc: 'Track your income, expenses, and savings with beautiful interactive charts and live financial insights.', color: '#2DD4BF' },
  { icon: <ShieldOutlinedIcon fontSize="large" />, title: 'Bank-grade Security', desc: '256-bit AES encryption protects all your financial data. Your privacy is our highest priority.', color: '#6366F1' },
  { icon: <SavingsIcon fontSize="large" />, title: 'Smart Budgeting', desc: 'Set monthly budgets per category and get AI-powered suggestions to optimize your spending habits.', color: '#34D399' },
  { icon: <NotificationsActiveIcon fontSize="large" />, title: 'Smart Alerts', desc: 'Receive instant notifications for bill reminders, overspending warnings, and unusual activity.', color: '#FBBF24' },
  { icon: <PieChartIcon fontSize="large" />, title: 'Spending Breakdown', desc: 'Visualise exactly where your money goes with detailed category breakdowns and trend analysis.', color: '#F472B6' },
  { icon: <SyncIcon fontSize="large" />, title: 'Multi-device Sync', desc: 'Seamlessly sync your data across all your devices in real-time, powered by Firebase Cloud.', color: '#FB923C' },
  { icon: <AutoAwesomeIcon fontSize="large" />, title: 'AI Insights', desc: 'Get personalised financial tips powered by machine learning based on your spending patterns.', color: '#A78BFA' },
  { icon: <PhoneAndroidIcon fontSize="large" />, title: 'Native Mobile App', desc: 'Built with React Native for a smooth, native experience on both Android and iOS devices.', color: '#38BDF8' },
];

/* ── Stat pills ─────────────────────────────────── */
const stats = [
  { value: '10K+', label: 'Active Users' },
  { value: '99.9%', label: 'Uptime' },
  { value: 'Rs. 500M+', label: 'Tracked' },
  { value: '4.8★', label: 'App Rating' },
];

const BgOrb = ({ sx }) => (
  <Box aria-hidden="true" sx={{ position: 'absolute', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', ...sx }} />
);

export default function AboutPage() {
  const [complaintEmail, setComplaintEmail] = useState('');
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintStatus, setComplaintStatus] = useState('idle'); // idle, loading, success, error
  const [complaintError, setComplaintError] = useState('');

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!complaintEmail || !complaintMessage) return;
    setComplaintStatus('loading');
    setComplaintError('');
    try {
      await addDoc(collection(db, 'notifications'), {
        title: 'New Complaint from User',
        body: complaintMessage,
        type: 'complaint',
        read: false,
        email: complaintEmail,
        createdAt: serverTimestamp()
      });
      setComplaintStatus('success');
      setComplaintEmail('');
      setComplaintMessage('');
      setTimeout(() => setComplaintStatus('idle'), 5000);
    } catch (err) {
      console.error(err);
      setComplaintStatus('error');
      setComplaintError(err.message || 'Failed to submit complaint.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(160deg,#070D18 0%,#0D1B2A 60%,#070D18 100%)', position: 'relative', overflow: 'hidden' }}>
      <BgOrb sx={{ width: 600, height: 600, background: 'rgba(45,212,191,0.05)', top: -200, left: -200 }} />
      <BgOrb sx={{ width: 500, height: 500, background: 'rgba(99,102,241,0.05)', bottom: 100, right: -150 }} />

      {/* ── NAV ── */}
      <Box component="nav" sx={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(7,13,24,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(45,212,191,0.1)',
        px: { xs: 2, md: 6 }, py: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="img" src="/images/logo.png" alt="FinGuard" sx={{ width: 36, height: 36, objectFit: 'contain' }} />
          <Typography fontWeight={800} fontSize="1.2rem" sx={{ color: '#F0F6FF' }}>FinGuard</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Link to="/about" style={{ color: '#2DD4BF', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>About</Link>
          <Button component={Link} to="/login" variant="contained" color="primary" size="small" sx={{ px: 2.5 }}>
            Admin Login
          </Button>
        </Box>
      </Box>

      {/* ── HERO ── */}
      <Box sx={{ textAlign: 'center', pt: { xs: 8, md: 12 }, pb: { xs: 6, md: 10 }, px: 3, position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Chip
            label="🚀  Now Available on Android"
            size="small"
            sx={{ mb: 3, background: 'rgba(45,212,191,0.1)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.25)', fontWeight: 600, px: 1 }}
          />
          <Typography variant="h1" fontWeight={800} sx={{
            fontSize: { xs: '2.5rem', md: '4rem' }, color: '#F0F6FF',
            lineHeight: 1.1, letterSpacing: '-0.03em', mb: 2,
          }}>
            Take Control of Your{' '}
            <Box component="span" sx={{ background: 'linear-gradient(90deg,#2DD4BF,#6366F1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Financial Future
            </Box>
          </Typography>
          <Typography sx={{ color: '#94A3B8', fontSize: { xs: '1rem', md: '1.2rem' }, maxWidth: 580, mx: 'auto', mb: 5, lineHeight: 1.7 }}>
            FinGuard is a personal finance management app built with React Native, Java &amp; Firebase — giving you real-time control over your money, budgets, and goals.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained" color="primary" size="large"
              startIcon={<GooglePlayIcon />}
              sx={{ px: 4, py: 1.5, fontSize: '1rem' }}
            >
              Download on Android
            </Button>
          </Box>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 3, md: 6 }, mt: 7, flexWrap: 'wrap' }}>
            {stats.map(({ value, label }) => (
              <Box key={label} sx={{ textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: '#2DD4BF', lineHeight: 1 }}>{value}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </motion.div>
      </Box>

      {/* ── APP MOCKUP SECTION ── */}
      <Container maxWidth="lg" sx={{ mb: 10 }}>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <Box sx={{
            borderRadius: 4, overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(45,212,191,0.08), rgba(99,102,241,0.08))',
            border: '1px solid rgba(45,212,191,0.15)',
            backdropFilter: 'blur(20px)',
            p: { xs: 4, md: 6 },
            display: 'flex', flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'center', gap: 5,
          }}>
            {/* Phone mockup */}
            <Box sx={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center' }}>
              <Box sx={{
                width: 220, height: 420, borderRadius: '32px',
                background: 'linear-gradient(160deg, #111E2E, #0D1B2A)',
                border: '2px solid rgba(45,212,191,0.25)',
                boxShadow: '0 20px 80px rgba(45,212,191,0.15)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
              }}>
                {/* Status bar */}
                <Box sx={{ px: 2, pt: 1.5, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ color: '#94A3B8', fontSize: '0.65rem', fontWeight: 600 }}>9:41</Typography>
                  <Box sx={{ width: 60, height: 6, borderRadius: 3, background: '#1E2D3D' }} />
                  <Typography sx={{ color: '#94A3B8', fontSize: '0.65rem' }}>●●●</Typography>
                </Box>
                {/* App header */}
                <Box sx={{ px: 2, pb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box component="img" src="/images/logo.png" sx={{ width: 20, height: 20, objectFit: 'contain' }} />
                    <Typography sx={{ color: '#F0F6FF', fontSize: '0.75rem', fontWeight: 700 }}>FinGuard</Typography>
                  </Box>
                  <Typography sx={{ color: '#94A3B8', fontSize: '0.6rem' }}>Good morning, Boseth 👋</Typography>
                  <Typography sx={{ color: '#2DD4BF', fontSize: '1.1rem', fontWeight: 800 }}>Rs. 124,500</Typography>
                  <Typography sx={{ color: '#64748B', fontSize: '0.55rem' }}>Total Balance</Typography>
                </Box>
                {/* Mini bars */}
                {['Food', 'Transport', 'Shopping', 'Healthcare'].map((cat, i) => (
                  <Box key={cat} sx={{ px: 2, mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                      <Typography sx={{ color: '#94A3B8', fontSize: '0.55rem' }}>{cat}</Typography>
                      <Typography sx={{ color: '#F0F6FF', fontSize: '0.55rem', fontWeight: 600 }}>{[32, 16, 24, 10][i]}%</Typography>
                    </Box>
                    <Box sx={{ height: 4, borderRadius: 2, background: 'rgba(45,212,191,0.1)' }}>
                      <Box sx={{ height: '100%', borderRadius: 2, width: `${[32, 16, 24, 10][i]}%`, background: ['#2DD4BF', '#6366F1', '#34D399', '#FBBF24'][i] }} />
                    </Box>
                  </Box>
                ))}
                {/* Bottom nav */}
                <Box sx={{ mt: 'auto', borderTop: '1px solid rgba(45,212,191,0.1)', display: 'flex', justifyContent: 'space-around', py: 1.5 }}>
                  {['🏠', '📊', '➕', '🔔', '👤'].map(icon => (
                    <Typography key={icon} sx={{ fontSize: '0.9rem' }}>{icon}</Typography>
                  ))}
                </Box>
              </Box>
            </Box>

            {/* Text content */}
            <Box sx={{ flex: 1 }}>
              <Chip label="Personal Finance App" size="small" sx={{ mb: 2, background: 'rgba(45,212,191,0.1)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.2)' }} />
              <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', mb: 2 }}>
                Built with cutting-edge technology
              </Typography>
              <Typography sx={{ color: '#94A3B8', lineHeight: 1.8, mb: 3 }}>
                FinGuard combines the power of React Native for a smooth cross-platform mobile experience, a robust Java backend for secure data processing, and Firebase for real-time cloud sync — all working together seamlessly.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {['React Native', 'Java Backend', 'Firebase', 'REST API', 'Cloud Firestore', 'Material Design'].map(tech => (
                  <Chip
                    key={tech} label={tech} size="small"
                    sx={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)', fontWeight: 500 }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </motion.div>
      </Container>

      {/* ── FEATURES ── */}
      <Container maxWidth="lg" sx={{ mb: 10 }}>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" fontWeight={800} sx={{ color: '#F0F6FF', mb: 1.5 }}>
              Everything you need to manage money
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: '1.05rem' }}>
              Powerful features designed to give you complete financial visibility
            </Typography>
          </Box>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 3,
          }}>
            {features.map(({ icon, title, desc, color }, i) => (
              <motion.div 
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card elevation={0} sx={{
                  background: 'rgba(17,30,46,0.8)',
                  border: `1px solid ${color}25`,
                  backdropFilter: 'blur(10px)',
                  height: '100%',
                  transition: 'all 0.25s ease',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 12px 40px ${color}20`, borderColor: `${color}50` },
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{
                      width: 50, height: 50, borderRadius: 2.5, mb: 2.5,
                      background: `${color}18`,
                      border: `1px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color,
                    }}>
                      {icon}
                    </Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', mb: 1, fontSize: '0.95rem' }}>{title}</Typography>
                    <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.7, fontSize: '0.82rem' }}>{desc}</Typography>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </Box>
        </motion.div>
      </Container>

      {/* ── TEAM ── */}
      <Container maxWidth="lg" sx={{ mb: 10 }}>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="👥  Meet the Builders" size="small" sx={{ mb: 2, background: 'rgba(45,212,191,0.1)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.2)', fontWeight: 600 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: '#F0F6FF', mb: 1.5 }}>Our Team</Typography>
            <Typography sx={{ color: '#64748B', fontSize: '1.05rem' }}>
              The passionate developers &amp; designers behind FinGuard
            </Typography>
          </Box>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
            gap: 3,
          }}>
            {team.map(({ name, role, photo, initials, color, gradient, bio }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card elevation={0} sx={{
                  textAlign: 'center',
                  background: 'rgba(17,30,46,0.85)',
                  border: '1px solid rgba(45,212,191,0.12)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  height: '100%',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: `0 16px 48px ${color}20`,
                    borderColor: `${color}40`,
                  },
                }}>
                  <Box sx={{ height: 4, background: gradient }} />
                  <CardContent sx={{ p: 3 }}>
                    {photo ? (
                      <Avatar
                        src={photo}
                        alt={name}
                        sx={{
                          width: 90, height: 90, mx: 'auto', mb: 2,
                          border: `3px solid ${color}50`,
                          boxShadow: `0 0 20px ${color}30`,
                        }}
                      />
                    ) : (
                      <Avatar sx={{
                        width: 90, height: 90, mx: 'auto', mb: 2,
                        background: gradient,
                        fontSize: '1.5rem', fontWeight: 800,
                        border: `3px solid ${color}50`,
                        boxShadow: `0 0 20px ${color}30`,
                      }}>
                        {initials}
                      </Avatar>
                    )}
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF', fontSize: '0.95rem', mb: 0.5 }}>
                      {name}
                    </Typography>
                    <Chip
                      label={role} size="small"
                      sx={{ background: `${color}15`, color, border: `1px solid ${color}30`, fontWeight: 600, fontSize: '0.7rem', mb: 2 }}
                    />
                    <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.78rem', lineHeight: 1.6 }}>
                      {bio}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </Box>
        </motion.div>
      </Container>

      {/* ── TECH STACK ── */}
      <Container maxWidth="md" sx={{ mb: 10 }}>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <Box sx={{
            textAlign: 'center', p: { xs: 4, md: 6 },
            borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(45,212,191,0.07), rgba(99,102,241,0.07))',
            border: '1px solid rgba(45,212,191,0.15)',
            backdropFilter: 'blur(20px)',
          }}>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', mb: 1.5 }}>Tech Stack</Typography>
            <Typography sx={{ color: '#64748B', mb: 4 }}>Built with modern, industry-leading technologies</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
              {[
                { name: 'React Native', category: 'Mobile', color: '#38BDF8' },
                { name: 'Java', category: 'Backend', color: '#FB923C' },
                { name: 'Firebase', category: 'Database', color: '#FBBF24' },
                { name: 'React + Vite', category: 'Admin Web', color: '#2DD4BF' },
                { name: 'Material UI', category: 'UI Library', color: '#6366F1' },
                { name: 'REST API', category: 'Integration', color: '#34D399' },
              ].map(({ name, category, color }, i) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <Box sx={{
                    px: 3, py: 2, borderRadius: 2.5,
                    background: `${color}0F`,
                    border: `1px solid ${color}25`,
                    textAlign: 'center',
                    minWidth: 120,
                    transition: 'all 0.2s ease',
                    '&:hover': { background: `${color}18`, transform: 'scale(1.05)' },
                  }}>
                    <Typography fontWeight={700} sx={{ color, fontSize: '0.9rem' }}>{name}</Typography>
                    <Typography sx={{ color: '#475569', fontSize: '0.72rem', mt: 0.3 }}>{category}</Typography>
                  </Box>
                </motion.div>
              ))}
            </Box>
          </Box>
        </motion.div>
      </Container>

      {/* ── COMPLAINT / CONTACT BOX ── */}
      <Container maxWidth="md" sx={{ mb: 10 }}>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <Box sx={{
            p: { xs: 4, md: 6 },
            borderRadius: 4,
            background: 'rgba(13,27,42,0.7)',
            border: '1px solid rgba(244,114,182,0.2)',
            backdropFilter: 'blur(20px)',
            position: 'relative',
          }}>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', mb: 1 }}>
              Have a Complaint or Feedback?
            </Typography>
            <Typography sx={{ color: '#94A3B8', mb: 4 }}>
              Send a direct message to the administration. We take your concerns seriously.
            </Typography>

            {complaintStatus === 'success' && (
              <Alert severity="success" sx={{ mb: 3, background: 'rgba(52,211,153,0.1)', color: '#34D399', '& .MuiAlert-icon': { color: '#34D399' } }}>
                Your message has been sent successfully. We will review it shortly.
              </Alert>
            )}

            {complaintStatus === 'error' && (
              <Alert severity="error" sx={{ mb: 3, background: 'rgba(248,113,113,0.1)', color: '#F87171', '& .MuiAlert-icon': { color: '#F87171' } }}>
                {complaintError}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmitComplaint} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Your Email Address"
                type="email"
                variant="outlined"
                fullWidth
                required
                value={complaintEmail}
                onChange={(e) => setComplaintEmail(e.target.value)}
                disabled={complaintStatus === 'loading'}
                sx={{
                  '& .MuiOutlinedInput-root': { color: '#F0F6FF', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover fieldset': { borderColor: '#F472B6' }, '&.Mui-focused fieldset': { borderColor: '#F472B6' } },
                  '& .MuiInputLabel-root': { color: '#94A3B8', '&.Mui-focused': { color: '#F472B6' } }
                }}
              />
              <TextField
                label="Your Message or Complaint"
                multiline
                rows={4}
                variant="outlined"
                fullWidth
                required
                value={complaintMessage}
                onChange={(e) => setComplaintMessage(e.target.value)}
                disabled={complaintStatus === 'loading'}
                sx={{
                  '& .MuiOutlinedInput-root': { color: '#F0F6FF', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover fieldset': { borderColor: '#F472B6' }, '&.Mui-focused fieldset': { borderColor: '#F472B6' } },
                  '& .MuiInputLabel-root': { color: '#94A3B8', '&.Mui-focused': { color: '#F472B6' } }
                }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={complaintStatus === 'loading'}
                sx={{
                  alignSelf: 'flex-start',
                  px: 4, py: 1.5,
                  background: 'linear-gradient(135deg,#F472B6,#BE185D)',
                  color: '#FFF',
                  fontWeight: 700,
                  '&:hover': { background: 'linear-gradient(135deg,#BE185D,#9D174D)' }
                }}
              >
                {complaintStatus === 'loading' ? <CircularProgress size={24} color="inherit" /> : 'Send Message'}
              </Button>
            </Box>
          </Box>
        </motion.div>
      </Container>

      {/* ── CTA ── */}
      <Container maxWidth="md" sx={{ mb: 12 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <Box sx={{
            textAlign: 'center', p: { xs: 5, md: 8 },
            borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(45,212,191,0.12), rgba(99,102,241,0.08))',
            border: '1px solid rgba(45,212,191,0.2)',
            backdropFilter: 'blur(20px)',
            position: 'relative', overflow: 'hidden',
          }}>
            <BgOrb sx={{ width: 300, height: 300, background: 'rgba(45,212,191,0.08)', top: -100, right: -100 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: '#F0F6FF', mb: 2 }}>
              Ready to take control of your finances?
            </Typography>
            <Typography sx={{ color: '#94A3B8', mb: 4, fontSize: '1.05rem' }}>
              Download FinGuard today and start your journey to financial freedom.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button variant="contained" color="primary" size="large" startIcon={<GooglePlayIcon />} sx={{ px: 4, py: 1.5 }}>
                Download on Android
              </Button>
            </Box>
          </Box>
        </motion.div>
      </Container>

      {/* ── FOOTER ── */}
      <Divider sx={{ borderColor: 'rgba(45,212,191,0.1)' }} />
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
          <Box component="img" src="/images/logo.png" alt="FinGuard" sx={{ width: 24, height: 24, objectFit: 'contain' }} />
          <Typography fontWeight={700} sx={{ color: '#F0F6FF' }}>FinGuard</Typography>
        </Box>
        <Typography variant="caption" sx={{ color: '#334155' }}>
          © 2025 FinGuard. Built by the FinGuard Team · LNBTI SEM4
        </Typography>
      </Box>
    </Box>
  );
}
