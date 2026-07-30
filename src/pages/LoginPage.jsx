import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, IconButton, Alert, Divider, CircularProgress,
  LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../App';
import { auth, db } from '../data/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { hashEmailForDocId, decryptPasswordWithAnswers } from '../security/recoveryCrypto';
import {
  sanitiseInput,
  validateEmail,
  validatePassword,
  checkLockout,
  recordFailedAttempt,
  clearLockout,
  formatLockoutRemaining,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from '../security/authSecurity';

// ─── Decorative background orb ───────────────────────────────────────────────
const BgOrb = ({ sx }) => (
  <Box
    aria-hidden="true"
    sx={{
      position: 'absolute',
      borderRadius: '50%',
      filter: 'blur(80px)',
      pointerEvents: 'none',
      ...sx,
    }}
  />
);

// ─── Feature list ─────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <BarChartIcon />,      label: 'Real-time Analytics & Reports'    },
  { icon: <ShieldOutlinedIcon />, label: 'Bank-grade 256-bit Encryption'   },
  { icon: <PhoneAndroidIcon />,  label: 'Seamless Mobile App Sync'         },
  { icon: <AutoAwesomeIcon />,   label: 'AI-Powered Financial Insights'    },
];

const QUOTES = [
  { text: "A budget is telling your money where to go instead of wondering where it went.", author: "Dave Ramsey" },
  { text: "Money grows on the tree of persistence.", author: "Japanese Proverb" },
  { text: "The habit of saving is itself an education.", author: "Thornton T. Munger" }
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  // ── Form state ──────────────────────────────────────────────────────────
  const [form, setForm]       = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError]     = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Lockout state ───────────────────────────────────────────────────────
  const [locked, setLocked]         = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);

  // ── Complaint Modal state ────────────────────────────────────────────────
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintEmail, setComplaintEmail] = useState('');
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintStatus, setComplaintStatus] = useState('idle');
  const [complaintError, setComplaintError] = useState('');

  // ── Forgot Password state ───────────────────────────────────────────────
  const [forgotPwdOpen, setForgotPwdOpen] = useState(false);
  const [forgotPwdStep, setForgotPwdStep] = useState(1); // 1 = Email, 2 = Questions
  const [forgotPwdEmail, setForgotPwdEmail] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState([]);
  const [recoveryBundle, setRecoveryBundle] = useState(null);
  const [securityAnswers, setSecurityAnswers] = useState({});
  const [forgotPwdStatus, setForgotPwdStatus] = useState('idle');
  const [forgotPwdError, setForgotPwdError] = useState('');

  // ── Derive inline validation errors ────────────────────────────────────
  const emailError    = touched.email    ? validateEmail(form.email).message    : '';
  const passwordError = touched.password ? validatePassword(form.password).message : '';
  const formValid     = !emailError && !passwordError && form.email && form.password;

  // ── Check for post-logout reason param ─────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get('reason');
    if (reason === 'idle')    setInfoMsg('You were logged out due to inactivity.');
    if (reason === 'expired') setInfoMsg('Your session has expired. Please sign in again.');
  }, [location.search]);

  // ── Auto-redirect if already signed in as admin ─────────────────────────
  useEffect(() => {
    if (user && !authLoading) navigate('/dashboard', { replace: true });
  }, [user, authLoading, navigate]);

  // ── Rotating Quote ──────────────────────────────────────────────────────
  const [quoteIndex, setQuoteIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── Lockout ticker ──────────────────────────────────────────────────────
  const refreshLockout = useCallback(() => {
    const { locked: isLocked, remainingMs } = checkLockout();
    setLocked(isLocked);
    setLockRemaining(remainingMs);
    return isLocked;
  }, []);

  useEffect(() => {
    refreshLockout();
    const id = setInterval(() => {
      const stillLocked = refreshLockout();
      if (!stillLocked) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [refreshLockout]);

  // ── Input handling ──────────────────────────────────────────────────────
  const handleChange = (e) => {
    // Sanitise on input to prevent XSS / injection
    const raw       = e.target.value;
    const fieldName = e.target.name;
    // For password we only trim length; do NOT strip quotes (valid in passwords)
    const sanitised = fieldName === 'password'
      ? raw.slice(0, 512)
      : sanitiseInput(raw, 320);

    setForm((prev) => ({ ...prev, [fieldName]: sanitised }));
    setError('');
  };

  const handleBlur = (e) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Mark all fields touched to show inline errors
    setTouched({ email: true, password: true });

    // Guard: lockout
    if (refreshLockout()) {
      setError(`Too many failed attempts. Please wait ${formatLockoutRemaining(lockRemaining)}.`);
      return;
    }

    // Guard: client-side validation
    const emailV    = validateEmail(form.email);
    const passwordV = validatePassword(form.password);
    if (!emailV.ok)    { setError(emailV.message);    return; }
    if (!passwordV.ok) { setError(passwordV.message); return; }

    setLoading(true);
    setError('');

    try {
      // 1. Firebase authentication (email/password — NoSQL, not SQL)
      const userCredential = await signInWithEmailAndPassword(
        auth,
        form.email.trim().toLowerCase(),
        form.password
      );
      const firebaseUser = userCredential.user;

      // 2. Role verification in Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc    = await getDoc(userDocRef);

      if (userDoc.exists() && userDoc.data().role === 'admin') {
        // Success — clear brute-force counter and proceed
        clearLockout();
        navigate('/dashboard', { replace: true });
      } else {
        // Not an admin — revoke Firebase session immediately
        await signOut(auth);
        const { locked: nowLocked } = recordFailedAttempt();
        if (nowLocked) {
          setError(`Access denied. Account locked for ${formatLockoutRemaining(LOCKOUT_DURATION_MS)}.`);
        } else {
          setError('Access denied: Administrators only.');
        }
        setLocked(nowLocked);
      }
    } catch (err) {
      console.error('[FinGuard] Authentication error:', err.code);

      // Generic error map — do NOT leak specific reasons to the UI
      let msg = 'Sign-in failed. Please check your credentials.';
      if (
        err.code === 'auth/user-not-found'    ||
        err.code === 'auth/wrong-password'    ||
        err.code === 'auth/invalid-credential'
      ) {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Firebase has temporarily blocked this account. Try again later.';
        // Still record locally so UI locks too
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network error. Please check your connection.';
      }

      // Record failed attempt (brute-force guard)
      const { locked: nowLocked, attemptsLeft } = recordFailedAttempt();
      refreshLockout();

      if (nowLocked) {
        msg = `Too many failed attempts. Please wait ${formatLockoutRemaining(LOCKOUT_DURATION_MS)} before trying again.`;
      } else if (attemptsLeft > 0 && attemptsLeft <= 2) {
        msg += ` (${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining)`;
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Complaint Submit ─────────────────────────────────────────────────────
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
      setTimeout(() => {
        setComplaintOpen(false);
        setComplaintStatus('idle');
      }, 3000);
    } catch (err) {
      console.error(err);
      setComplaintStatus('error');
      setComplaintError(err.message || 'Failed to submit complaint.');
    }
  };

  // ── Forgot Password Handlers ───────────────────────────────────────────────
  const handleForgotPasswordSubmitEmail = async (e) => {
    e.preventDefault();
    if (!forgotPwdEmail) return;
    setForgotPwdStatus('loading');
    setForgotPwdError('');
    try {
      const emailHash = await hashEmailForDocId(forgotPwdEmail);
      const docSnap = await getDoc(doc(db, 'admin_recovery', emailHash));
      if (!docSnap.exists()) {
        throw new Error('No recovery data found for this admin email. Ensure questions are set up.');
      }
      
      const data = docSnap.data();
      setSecurityQuestions(data.questions.map((q, idx) => ({ id: `q${idx}`, question: q })));
      setRecoveryBundle(data);
      setForgotPwdStep(2);
      setForgotPwdStatus('idle');
    } catch (err) {
      console.error(err);
      setForgotPwdStatus('error');
      setForgotPwdError(err.message || 'Failed to retrieve security questions. Ensure this is an admin email and questions are set up.');
    }
  };

  const handleForgotPasswordSubmitAnswers = async (e) => {
    e.preventDefault();
    setForgotPwdStatus('loading');
    setForgotPwdError('');
    try {
      // Collect answers in the same order as questions
      const answersArray = securityQuestions.map(sq => securityAnswers[sq.id] || '');
      
      let decryptedPassword;
      try {
        decryptedPassword = await decryptPasswordWithAnswers(recoveryBundle, answersArray);
      } catch (decryptErr) {
        throw new Error('Incorrect answers to security questions.', { cause: decryptErr });
      }
      
      // Login with decrypted password
      await signInWithEmailAndPassword(auth, forgotPwdEmail.trim().toLowerCase(), decryptedPassword);
      
      // Success - close modal and redirect to settings
      setForgotPwdOpen(false);
      // Pass the decrypted password so they don't have to type it again in Settings
      navigate('/settings', { state: { forcePasswordChange: true, recoveryPassword: decryptedPassword }, replace: true });
    } catch (err) {
      console.error(err);
      setForgotPwdStatus('error');
      setForgotPwdError(err.message || 'Failed to verify answers or log in.');
    }
  };

  // ── Lockout countdown string ─────────────────────────────────────────────
  const lockCountdown = formatLockoutRemaining(lockRemaining);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        background: 'linear-gradient(135deg, #070D18 0%, #0D1B2A 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background orbs */}
      <BgOrb sx={{ width: 500, height: 500, background: 'rgba(45,212,191,0.06)', top: -150, left: -100 }} />
      <BgOrb sx={{ width: 400, height: 400, background: 'rgba(99,102,241,0.06)', bottom: -100, right: -80 }} />
      <BgOrb sx={{ width: 300, height: 300, background: 'rgba(52,211,153,0.04)', top: '40%', left: '30%' }} />

      {/* ── Left Branding Panel ─────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          px: 8,
          position: 'relative',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 5 }}>
          <Box
            component="img"
            src="/images/logo.png"
            alt="FinGuard Logo"
            sx={{ width: 56, height: 56, objectFit: 'contain' }}
          />
          <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>
            FinGuard
          </Typography>
        </Box>

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Typography variant="h2" fontWeight={800} sx={{ color: '#F0F6FF', mb: 2, lineHeight: 1.15, letterSpacing: '-0.03em' }}>
            Personal Finance,<br />
            <Box component="span" sx={{ background: 'linear-gradient(90deg, #2DD4BF, #6366F1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Professionally Managed
            </Box>
          </Typography>
        </motion.div>

        <Typography variant="body1" sx={{ color: '#94A3B8', mb: 5, fontSize: '1.05rem', maxWidth: 420 }}>
          Empower your users with intelligent financial tracking, real-time insights, and bank-grade security — all in one platform.
        </Typography>

        {FEATURES.map(({ icon, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(45,212,191,0.15), rgba(45,212,191,0.05))',
              border: '1px solid rgba(45,212,191,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2DD4BF',
            }}>
              {icon}
            </Box>
            <Typography sx={{ color: '#CBD5E1', fontWeight: 500 }}>{label}</Typography>
          </Box>
        ))}

        <Box sx={{ display: 'flex', gap: 4, mt: 5 }}>
          {[['10K+', 'Active Users'], ['99.9%', 'Uptime SLA'], ['256-bit', 'Encryption']].map(([val, lbl]) => (
            <Box key={lbl}>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#2DD4BF' }}>{val}</Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>{lbl}</Typography>
            </Box>
          ))}
        </Box>

        {/* Animated Quotes Carousel */}
        <Box sx={{ mt: 6, minHeight: 100, position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={quoteIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              style={{ position: 'absolute' }}
            >
              <Typography variant="body1" sx={{ color: '#CBD5E1', fontStyle: 'italic', mb: 1 }}>
                "{QUOTES[quoteIndex].text}"
              </Typography>
              <Typography variant="caption" sx={{ color: '#2DD4BF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                — {QUOTES[quoteIndex].author}
              </Typography>
            </motion.div>
          </AnimatePresence>
        </Box>

        <Box sx={{ mt: 8 }}>
          <Link to="/about" style={{ color: '#2DD4BF', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            Learn more about FinGuard →
          </Link>
        </Box>
      </Box>

      {/* ── Right Login Card ────────────────────────────────────────────── */}
      <Box
        sx={{
          width: { xs: '100%', md: 480 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, md: 5 },
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ width: '100%', maxWidth: 420 }}
        >
          <Card
            elevation={0}
            sx={{
              width: '100%',
              background: 'rgba(13,27,42,0.85)',
              border: `1px solid ${locked ? 'rgba(248,113,113,0.25)' : 'rgba(45,212,191,0.15)'}`,
              backdropFilter: 'blur(24px)',
              borderRadius: 4,
              p: 1,
              transition: 'border-color 0.3s',
            }}
          >
            <CardContent sx={{ p: 4 }}>
            {/* Mobile logo */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box component="img" src="/images/logo.png" alt="FinGuard" sx={{ width: 36, height: 36, objectFit: 'contain' }} />
              <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF' }}>FinGuard</Typography>
            </Box>

            <Typography variant="h5" fontWeight={700} sx={{ color: '#F0F6FF', mb: 0.5 }}>
              Admin Portal
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
              Sign in to access the admin dashboard
            </Typography>

            {/* Info message (e.g. session expired) */}
            {infoMsg && !error && (
              <Alert
                severity="info"
                onClose={() => setInfoMsg('')}
                sx={{ mb: 2.5, borderRadius: 2, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                {infoMsg}
              </Alert>
            )}

            {/* Error message */}
            {error && (
              <Alert
                severity="error"
                id="loginErrorAlert"
                sx={{ mb: 2.5, borderRadius: 2, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}
              >
                {error}
              </Alert>
            )}

            {/* Locked-out banner */}
            {locked && (
              <Box
                sx={{
                  mb: 3, p: 2.5, borderRadius: 3,
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.25)',
                  textAlign: 'center',
                }}
              >
                <TimerOutlinedIcon sx={{ color: '#F87171', mb: 1, fontSize: 32 }} />
                <Typography sx={{ color: '#F87171', fontWeight: 700, fontSize: '0.95rem' }}>
                  Account Temporarily Locked
                </Typography>
                <Typography sx={{ color: '#94A3B8', fontSize: '0.82rem', mt: 0.5 }}>
                  Try again in <strong style={{ color: '#FCA5A5' }}>{lockCountdown}</strong>
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(lockRemaining / (15 * 60 * 1000)) * 100}
                  sx={{
                    mt: 2, borderRadius: 2, height: 4,
                    background: 'rgba(255,255,255,0.05)',
                    '& .MuiLinearProgress-bar': {
                      background: 'linear-gradient(90deg,#F87171,#EF4444)',
                      borderRadius: 2,
                    },
                  }}
                />
              </Box>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate autoComplete="off">
              {/* Email */}
              <TextField
                fullWidth
                label="Email Address"
                name="email"
                type="email"
                id="loginEmailInput"
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="username"
                required
                disabled={locked || loading}
                error={Boolean(emailError)}
                helperText={emailError}
                inputProps={{ maxLength: 320, 'aria-label': 'Email address' }}
                sx={{ mb: emailError ? 1.5 : 2.5 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlinedIcon sx={{ color: emailError ? '#F87171' : '#2DD4BF', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Password */}
              <TextField
                fullWidth
                label="Password"
                name="password"
                id="loginPasswordInput"
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="current-password"
                required
                disabled={locked || loading}
                error={Boolean(passwordError)}
                helperText={passwordError}
                inputProps={{ maxLength: 512, 'aria-label': 'Password' }}
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon sx={{ color: passwordError ? '#F87171' : '#2DD4BF', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPwd((v) => !v)}
                        edge="end"
                        size="small"
                        disabled={locked || loading}
                        sx={{ color: '#64748B' }}
                      >
                        {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3, mt: -1.5 }}>
                <Typography 
                  onClick={() => { setForgotPwdOpen(true); setForgotPwdStep(1); setForgotPwdEmail(''); setForgotPwdError(''); }}
                  sx={{ color: '#2DD4BF', cursor: 'pointer', fontSize: '0.82rem', '&:hover': { textDecoration: 'underline' } }}
                >
                  Forgot Password?
                </Typography>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                disabled={loading || locked}
                id="loginSubmitBtn"
                sx={{ py: 1.6, fontSize: '1rem', position: 'relative' }}
              >
                {loading ? (
                  <CircularProgress size={22} sx={{ color: '#0D1B2A' }} />
                ) : locked ? (
                  `Locked · ${lockCountdown}`
                ) : (
                  'Sign In to Dashboard'
                )}
              </Button>
            </Box>

            <Divider sx={{ my: 3, borderColor: 'rgba(45,212,191,0.1)', '&::before,&::after': { borderColor: 'rgba(45,212,191,0.1)' } }}>
              <Typography variant="caption" sx={{ color: '#475569' }}>Security Info</Typography>
            </Divider>

            <Box sx={{
              p: 2, borderRadius: 2,
              background: 'rgba(45,212,191,0.05)',
              border: '1px dashed rgba(45,212,191,0.2)',
            }}>
              <Typography variant="body2" sx={{ color: '#94A3B8', fontSize: '0.8rem', lineHeight: 1.6 }}>
                🔒 This portal is restricted to <strong>administrators only</strong>. All sign-in attempts are logged.
                After <strong>{MAX_LOGIN_ATTEMPTS} failed</strong> attempts the form is locked for 15 minutes.
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'center', mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link to="/about" style={{ color: '#64748B', textDecoration: 'none', fontSize: '0.82rem' }}>
                Learn about FinGuard App →
              </Link>
              <Typography 
                onClick={() => setComplaintOpen(true)}
                sx={{ color: '#F472B6', cursor: 'pointer', fontSize: '0.82rem', '&:hover': { textDecoration: 'underline' } }}
              >
                File a Complaint to Admin
              </Typography>
            </Box>
          </CardContent>
        </Card>
        </motion.div>
      </Box>

      {/* ── Complaint Modal ────────────────────────────────────────────── */}
      <Dialog 
        open={complaintOpen} 
        onClose={() => {
          if (complaintStatus !== 'loading') setComplaintOpen(false);
        }}
        PaperProps={{
          sx: {
            background: 'rgba(13,27,42,0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(244,114,182,0.2)',
            borderRadius: 3,
            minWidth: { xs: '90vw', sm: 400 }
          }
        }}
      >
        <DialogTitle sx={{ color: '#F0F6FF', fontWeight: 700, pb: 1 }}>
          File a Complaint
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Typography sx={{ color: '#94A3B8', fontSize: '0.85rem', mb: 3 }}>
            Send a direct message to the administration. We take your concerns seriously.
          </Typography>
          
          {complaintStatus === 'success' && (
            <Alert severity="success" sx={{ mb: 3, background: 'rgba(52,211,153,0.1)', color: '#34D399', '& .MuiAlert-icon': { color: '#34D399' } }}>
              Your message has been sent successfully.
            </Alert>
          )}

          {complaintStatus === 'error' && (
            <Alert severity="error" sx={{ mb: 3, background: 'rgba(248,113,113,0.1)', color: '#F87171', '& .MuiAlert-icon': { color: '#F87171' } }}>
              {complaintError}
            </Alert>
          )}

          <Box component="form" id="complaint-form" onSubmit={handleSubmitComplaint} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Your Email Address"
              type="email"
              variant="outlined"
              fullWidth
              required
              value={complaintEmail}
              onChange={(e) => setComplaintEmail(e.target.value)}
              disabled={complaintStatus === 'loading' || complaintStatus === 'success'}
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
              disabled={complaintStatus === 'loading' || complaintStatus === 'success'}
              sx={{
                '& .MuiOutlinedInput-root': { color: '#F0F6FF', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover fieldset': { borderColor: '#F472B6' }, '&.Mui-focused fieldset': { borderColor: '#F472B6' } },
                '& .MuiInputLabel-root': { color: '#94A3B8', '&.Mui-focused': { color: '#F472B6' } }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setComplaintOpen(false)} 
            disabled={complaintStatus === 'loading'}
            sx={{ color: '#94A3B8' }}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="complaint-form"
            variant="contained" 
            disabled={complaintStatus === 'loading' || complaintStatus === 'success'}
            sx={{
              background: 'linear-gradient(135deg,#F472B6,#BE185D)',
              color: '#FFF',
              fontWeight: 700,
              '&:hover': { background: 'linear-gradient(135deg,#BE185D,#9D174D)' }
            }}
          >
            {complaintStatus === 'loading' ? <CircularProgress size={20} color="inherit" /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Forgot Password Modal ────────────────────────────────────────────── */}
      <Dialog 
        open={forgotPwdOpen} 
        onClose={() => {
          if (forgotPwdStatus !== 'loading') setForgotPwdOpen(false);
        }}
        PaperProps={{
          sx: {
            background: 'rgba(13,27,42,0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(45,212,191,0.2)',
            borderRadius: 3,
            minWidth: { xs: '90vw', sm: 400 }
          }
        }}
      >
        <DialogTitle sx={{ color: '#F0F6FF', fontWeight: 700, pb: 1 }}>
          Recover Admin Account
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Typography sx={{ color: '#94A3B8', fontSize: '0.85rem', mb: 3 }}>
            {forgotPwdStep === 1 
              ? 'Enter your admin email address to retrieve your security questions.' 
              : 'Answer your security questions to log in and reset your password.'}
          </Typography>

          {forgotPwdError && (
            <Alert severity="error" sx={{ mb: 3, background: 'rgba(248,113,113,0.1)', color: '#F87171', '& .MuiAlert-icon': { color: '#F87171' } }}>
              {forgotPwdError}
            </Alert>
          )}

          {forgotPwdStep === 1 ? (
            <Box component="form" id="forgotpwd-form-1" onSubmit={handleForgotPasswordSubmitEmail} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Admin Email Address"
                type="email"
                variant="outlined"
                fullWidth
                required
                value={forgotPwdEmail}
                onChange={(e) => setForgotPwdEmail(e.target.value)}
                disabled={forgotPwdStatus === 'loading'}
                sx={{
                  '& .MuiOutlinedInput-root': { color: '#F0F6FF', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover fieldset': { borderColor: '#2DD4BF' }, '&.Mui-focused fieldset': { borderColor: '#2DD4BF' } },
                  '& .MuiInputLabel-root': { color: '#94A3B8', '&.Mui-focused': { color: '#2DD4BF' } }
                }}
              />
            </Box>
          ) : (
            <Box component="form" id="forgotpwd-form-2" onSubmit={handleForgotPasswordSubmitAnswers} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {securityQuestions.map((sq, idx) => (
                <Box key={sq.id} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ color: '#F0F6FF', fontSize: '0.85rem' }}>{idx + 1}. {sq.question}</Typography>
                  <TextField
                    variant="outlined"
                    size="small"
                    fullWidth
                    required
                    value={securityAnswers[sq.id] || ''}
                    onChange={(e) => setSecurityAnswers({ ...securityAnswers, [sq.id]: e.target.value })}
                    disabled={forgotPwdStatus === 'loading'}
                    sx={{
                      '& .MuiOutlinedInput-root': { color: '#F0F6FF', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover fieldset': { borderColor: '#2DD4BF' }, '&.Mui-focused fieldset': { borderColor: '#2DD4BF' } },
                    }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => {
              if (forgotPwdStep === 2) setForgotPwdStep(1);
              else setForgotPwdOpen(false);
            }} 
            disabled={forgotPwdStatus === 'loading'}
            sx={{ color: '#94A3B8' }}
          >
            {forgotPwdStep === 2 ? 'Back' : 'Cancel'}
          </Button>
          <Button 
            type="submit" 
            form={forgotPwdStep === 1 ? "forgotpwd-form-1" : "forgotpwd-form-2"}
            variant="contained" 
            disabled={forgotPwdStatus === 'loading'}
            sx={{
              background: 'linear-gradient(135deg,#2DD4BF,#0D9488)',
              color: '#FFF',
              fontWeight: 700,
              '&:hover': { background: 'linear-gradient(135deg,#0D9488,#0F766E)' }
            }}
          >
            {forgotPwdStatus === 'loading' ? <CircularProgress size={20} color="inherit" /> : (forgotPwdStep === 1 ? 'Next' : 'Verify & Login')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
