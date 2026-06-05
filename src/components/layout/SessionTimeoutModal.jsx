import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, Box, Typography, Button, LinearProgress,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

const WARNING_SECONDS = 120; // 2-minute countdown shown in modal

export default function SessionTimeoutModal({ onStay, onLogout }) {
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onLogout();
      return;
    }
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [secondsLeft, onLogout]);

  const pct = (secondsLeft / WARNING_SECONDS) * 100;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
  const isUrgent = secondsLeft <= 30;

  return (
    <Dialog
      open
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          background: 'rgba(13,27,42,0.97)',
          border: '1px solid rgba(45,212,191,0.2)',
          backdropFilter: 'blur(24px)',
          borderRadius: 4,
          maxWidth: 420,
          width: '100%',
          p: 1,
        },
      }}
      BackdropProps={{
        sx: { backdropFilter: 'blur(6px)', background: 'rgba(7,13,24,0.7)' },
      }}
    >
      <DialogContent sx={{ p: 4, textAlign: 'center' }}>
        {/* Icon */}
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: isUrgent
              ? 'linear-gradient(135deg,rgba(248,113,113,0.2),rgba(248,113,113,0.05))'
              : 'linear-gradient(135deg,rgba(251,191,36,0.2),rgba(251,191,36,0.05))',
            border: `1px solid ${isUrgent ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.4)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
            animation: isUrgent ? 'pulse 1s infinite' : 'none',
            '@keyframes pulse': {
              '0%,100%': { boxShadow: `0 0 0 0 ${isUrgent ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.4)'}` },
              '50%': { boxShadow: `0 0 0 12px transparent` },
            },
          }}
        >
          <AccessTimeIcon sx={{ fontSize: 36, color: isUrgent ? '#F87171' : '#FBB924' }} />
        </Box>

        <Typography variant="h5" fontWeight={800} sx={{ color: '#F0F6FF', mb: 1 }}>
          Session Expiring
        </Typography>
        <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3, lineHeight: 1.6 }}>
          You have been inactive for a while. Your session will automatically end to keep your account secure.
        </Typography>

        {/* Countdown */}
        <Box
          sx={{
            background: isUrgent ? 'rgba(248,113,113,0.08)' : 'rgba(45,212,191,0.06)',
            border: `1px solid ${isUrgent ? 'rgba(248,113,113,0.2)' : 'rgba(45,212,191,0.15)'}`,
            borderRadius: 3,
            p: 2.5,
            mb: 3,
          }}
        >
          <Typography
            variant="h3"
            fontWeight={800}
            sx={{ color: isUrgent ? '#F87171' : '#2DD4BF', fontVariantNumeric: 'tabular-nums' }}
          >
            {timeStr}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            seconds remaining
          </Typography>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              mt: 2,
              borderRadius: 2,
              height: 4,
              background: 'rgba(255,255,255,0.05)',
              '& .MuiLinearProgress-bar': {
                background: isUrgent
                  ? 'linear-gradient(90deg, #F87171, #EF4444)'
                  : 'linear-gradient(90deg, #2DD4BF, #6366F1)',
                borderRadius: 2,
              },
            }}
          />
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={onLogout}
            id="sessionLogoutBtn"
            sx={{
              borderColor: 'rgba(248,113,113,0.4)',
              color: '#F87171',
              borderRadius: 2,
              py: 1.4,
              fontWeight: 600,
              '&:hover': { borderColor: '#F87171', background: 'rgba(248,113,113,0.05)' },
            }}
          >
            <LockOutlinedIcon sx={{ mr: 1, fontSize: 18 }} />
            Log Out Now
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={onStay}
            id="sessionStayBtn"
            sx={{
              background: 'linear-gradient(135deg, #2DD4BF, #0D9488)',
              borderRadius: 2,
              py: 1.4,
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(45,212,191,0.3)',
              '&:hover': { background: 'linear-gradient(135deg, #5EEAD4, #2DD4BF)', transform: 'translateY(-1px)' },
              transition: 'all 0.2s',
            }}
          >
            Stay Logged In
          </Button>
        </Box>

        <Typography variant="caption" sx={{ color: '#334155', mt: 2, display: 'block' }}>
          🔒 FinGuard auto-locks after 30 minutes of inactivity
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
