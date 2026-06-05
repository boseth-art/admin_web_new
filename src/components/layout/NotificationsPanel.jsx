/**
 * NotificationsPanel.jsx
 * A slide-in notifications drawer that reads from the Firestore
 * `notifications` collection and lets the admin mark items as read.
 *
 * Expected Firestore document shape (collection: `notifications`):
 * {
 *   title:     string,
 *   body:      string,
 *   type:      'user' | 'alert' | 'system' | 'report',
 *   read:      boolean,
 *   createdAt: Timestamp  (Firestore server timestamp)
 * }
 */
import { useState, useEffect } from 'react';
import {
  Drawer, Box, Typography, IconButton, Divider, Chip,
  CircularProgress, Tooltip, Badge,
} from '@mui/material';
import CloseIcon           from '@mui/icons-material/Close';
import NotificationsIcon   from '@mui/icons-material/Notifications';
import PersonIcon          from '@mui/icons-material/Person';
import WarningAmberIcon    from '@mui/icons-material/WarningAmber';
import SettingsIcon        from '@mui/icons-material/Settings';
import AssessmentIcon      from '@mui/icons-material/Assessment';
import DoneAllIcon         from '@mui/icons-material/DoneAll';
import InboxIcon           from '@mui/icons-material/Inbox';
import { db } from '../../data/firebase';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, writeBatch, Timestamp,
} from 'firebase/firestore';

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  user:   { icon: <PersonIcon sx={{ fontSize: 16 }} />,        color: '#2DD4BF', bg: 'rgba(45,212,191,0.12)'  },
  alert:  { icon: <WarningAmberIcon sx={{ fontSize: 16 }} />,  color: '#FBBF24', bg: 'rgba(251,191,36,0.12)'  },
  system: { icon: <SettingsIcon sx={{ fontSize: 16 }} />,      color: '#34D399', bg: 'rgba(52,211,153,0.12)'  },
  report: { icon: <AssessmentIcon sx={{ fontSize: 16 }} />,    color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
};

// ─── Relative time helper ─────────────────────────────────────────────────────
function relativeTime(ts) {
  if (!ts) return '';
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  const diff  = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Notification item ────────────────────────────────────────────────────────
function NotifItem({ notif, onMarkRead }) {
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
  return (
    <Box
      onClick={() => !notif.read && onMarkRead(notif.id)}
      sx={{
        display: 'flex',
        gap: 2,
        px: 3,
        py: 2,
        cursor: notif.read ? 'default' : 'pointer',
        background: notif.read ? 'transparent' : 'rgba(45,212,191,0.03)',
        borderLeft: notif.read ? '3px solid transparent' : `3px solid ${cfg.color}`,
        transition: 'background 0.2s',
        '&:hover': { background: 'rgba(255,255,255,0.03)' },
      }}
    >
      {/* Icon bubble */}
      <Box
        sx={{
          width: 34, height: 34, borderRadius: '50%',
          background: cfg.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: cfg.color, flexShrink: 0, mt: 0.3,
        }}
      >
        {cfg.icon}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Typography
            sx={{
              color: notif.read ? '#64748B' : '#F0F6FF',
              fontSize: '0.85rem',
              fontWeight: notif.read ? 400 : 600,
              lineHeight: 1.4,
            }}
          >
            {notif.title}
          </Typography>
          {!notif.read && (
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#2DD4BF', flexShrink: 0, mt: 0.6 }} />
          )}
        </Box>
        <Typography sx={{ color: '#475569', fontSize: '0.78rem', mt: 0.3, lineHeight: 1.4 }}>
          {notif.body}
        </Typography>
        <Typography sx={{ color: '#334155', fontSize: '0.72rem', mt: 0.5 }}>
          {relativeTime(notif.createdAt)}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function NotificationsPanel() {
  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);

  // Real-time Firestore listener
  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(list);
      setLoading(false);
    }, (err) => {
      console.error('[FinGuard] Notifications listener error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark a single notification as read
  const markRead = async (id) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('[FinGuard] markRead error:', err);
    }
  };

  // Mark all as read in one batch
  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
      await batch.commit();
    } catch (err) {
      console.error('[FinGuard] markAllRead error:', err);
    }
  };

  return (
    <>
      {/* Bell button in AppBar */}
      <Tooltip title="Notifications">
        <IconButton
          id="notificationsBellBtn"
          aria-label="Open notifications"
          onClick={() => setOpen(true)}
          sx={{ color: '#94A3B8', '&:hover': { color: '#2DD4BF' } }}
        >
          <Badge
            badgeContent={unreadCount || null}
            color="error"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16, padding: '0 4px' } }}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Slide-in drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 400 },
            background: '#0D1B2A',
            borderLeft: '1px solid rgba(45,212,191,0.12)',
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 3, py: 2.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(45,212,191,0.1)',
          position: 'sticky', top: 0, zIndex: 10,
          background: 'rgba(13,27,42,0.95)',
          backdropFilter: 'blur(12px)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <NotificationsIcon sx={{ color: '#2DD4BF', fontSize: 20 }} />
            <Typography fontWeight={700} sx={{ color: '#F0F6FF', fontSize: '1rem' }}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} new`}
                size="small"
                sx={{ background: 'rgba(45,212,191,0.15)', color: '#2DD4BF', fontWeight: 700, fontSize: '0.7rem', height: 20 }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {unreadCount > 0 && (
              <Tooltip title="Mark all as read">
                <IconButton
                  size="small"
                  onClick={markAllRead}
                  id="markAllReadBtn"
                  sx={{ color: '#475569', '&:hover': { color: '#2DD4BF' } }}
                >
                  <DoneAllIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
              sx={{ color: '#475569', '&:hover': { color: '#F87171' } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
              <CircularProgress color="primary" size={28} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', pt: 10, px: 3 }}>
              <InboxIcon sx={{ fontSize: 52, color: '#1E3A5F', mb: 2 }} />
              <Typography sx={{ color: '#475569', fontSize: '0.9rem', fontWeight: 500 }}>
                No notifications yet
              </Typography>
              <Typography sx={{ color: '#334155', fontSize: '0.78rem', mt: 0.5 }}>
                Add documents to the{' '}
                <Box component="span" sx={{ color: '#2DD4BF', fontFamily: 'monospace' }}>
                  notifications
                </Box>{' '}
                collection in Firestore.
              </Typography>
            </Box>
          ) : (
            <>
              {/* Unread section */}
              {notifications.some(n => !n.read) && (
                <>
                  <Typography sx={{ px: 3, pt: 2.5, pb: 1, color: '#475569', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Unread
                  </Typography>
                  {notifications.filter(n => !n.read).map(n => (
                    <NotifItem key={n.id} notif={n} onMarkRead={markRead} />
                  ))}
                  <Divider sx={{ borderColor: 'rgba(45,212,191,0.07)', my: 1 }} />
                </>
              )}

              {/* Read section */}
              {notifications.some(n => n.read) && (
                <>
                  <Typography sx={{ px: 3, pt: 1.5, pb: 1, color: '#334155', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Earlier
                  </Typography>
                  {notifications.filter(n => n.read).map(n => (
                    <NotifItem key={n.id} notif={n} onMarkRead={markRead} />
                  ))}
                </>
              )}
            </>
          )}
        </Box>

        {/* Footer */}
        {notifications.length > 0 && (
          <Box sx={{
            px: 3, py: 2,
            borderTop: '1px solid rgba(45,212,191,0.08)',
            background: 'rgba(7,13,24,0.6)',
          }}>
            <Typography sx={{ color: '#334155', fontSize: '0.75rem', textAlign: 'center' }}>
              {notifications.length} total · {unreadCount} unread · Click an item to mark as read
            </Typography>
          </Box>
        )}
      </Drawer>
    </>
  );
}
