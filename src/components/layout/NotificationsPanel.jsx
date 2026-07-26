/**
 * NotificationsPanel.jsx
 * Slide-in notifications drawer with admin reply actions for complaint notifications.
 *
 * Option B implementation: no Cloud Functions — all writes go directly to Firestore
 * from the client using the admin's authenticated session.
 *
 * Flow:
 *   1. Query users collection by email → resolve UID client-side
 *   2. Write admin_reply doc to notifications collection
 *   3. Update original complaint doc with replied:true
 */
import { useState, useEffect } from "react";
import {
  Drawer, Box, Typography, IconButton, Divider, Chip,
  CircularProgress, Tooltip, Badge, Button, Snackbar, Alert,
} from "@mui/material";
import CloseIcon           from "@mui/icons-material/Close";
import NotificationsIcon   from "@mui/icons-material/Notifications";
import PersonIcon          from "@mui/icons-material/Person";
import WarningAmberIcon    from "@mui/icons-material/WarningAmber";
import SettingsIcon        from "@mui/icons-material/Settings";
import AssessmentIcon      from "@mui/icons-material/Assessment";
import DoneAllIcon         from "@mui/icons-material/DoneAll";
import InboxIcon           from "@mui/icons-material/Inbox";
import ReplyIcon           from "@mui/icons-material/Reply";
import CheckCircleIcon     from "@mui/icons-material/CheckCircle";
import BoltIcon            from "@mui/icons-material/Bolt";
import SupportAgentIcon    from "@mui/icons-material/SupportAgent";
import { db }              from "../../data/firebase";
import {
  collection, query, orderBy, where, onSnapshot,
  doc, addDoc, updateDoc, writeBatch, Timestamp, limit, getDocs,
  serverTimestamp,
} from "firebase/firestore";
import ReplyDialog from "./ReplyDialog";

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  user:        { icon: <PersonIcon sx={{ fontSize: 16 }} />,        color: "#2DD4BF", bg: "rgba(45,212,191,0.12)"  },
  alert:       { icon: <WarningAmberIcon sx={{ fontSize: 16 }} />,  color: "#FBBF24", bg: "rgba(251,191,36,0.12)"  },
  system:      { icon: <SettingsIcon sx={{ fontSize: 16 }} />,      color: "#34D399", bg: "rgba(52,211,153,0.12)"  },
  report:      { icon: <AssessmentIcon sx={{ fontSize: 16 }} />,    color: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
  complaint:   { icon: <SupportAgentIcon sx={{ fontSize: 16 }} />,  color: "#F472B6", bg: "rgba(244,114,182,0.12)" },
  admin_reply: { icon: <ReplyIcon sx={{ fontSize: 16 }} />,         color: "#6366F1", bg: "rgba(99,102,241,0.12)"  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Relative time display */
function relativeTime(ts) {
  if (!ts) return "";
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  const diff  = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Resolve a user UID by querying the users collection for a matching email.
 * Returns the uid string, or null if not found (guest complaint).
 */
async function resolveUidByEmail(email) {
  if (!email) return null;
  try {
    const q    = query(
      collection(db, "users"),
      where("email", "==", email.toLowerCase().trim()),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].id; // doc ID == uid
  } catch (err) {
    console.error("[FinGuard] resolveUidByEmail error:", err);
    return null;
  }
}

/**
 * Write an admin_reply notification directly to Firestore and
 * mark the original complaint as replied.
 */
async function sendReplyToFirestore({ complaintId, email, title, body }) {
  // 1. Look up user UID from email
  const targetUid = await resolveUidByEmail(email);

  // 2. Write the reply notification (readable by the mobile app via uid filter)
  await addDoc(collection(db, "notifications"), {
    title,
    body,
    type:               "admin_reply",
    read:               false,
    uid:                targetUid || null,
    email,
    isUserTargeted:     true,
    replyToComplaintId: complaintId,
    createdAt:          serverTimestamp(),
  });

  // 3. Mark the original complaint as replied
  await updateDoc(doc(db, "notifications", complaintId), {
    replied:   true,
    repliedAt: serverTimestamp(),
  });
}

// ─── Acknowledgement button ───────────────────────────────────────────────────
function AckButton({ complaint, onAckSent }) {
  const [ackStatus, setAckStatus] = useState("idle"); // idle | loading | done | error

  const alreadyReplied = complaint.replied === true;

  const handleAck = async () => {
    if (alreadyReplied || ackStatus !== "idle") return;
    setAckStatus("loading");
    try {
      await sendReplyToFirestore({
        complaintId: complaint.id,
        email:       complaint.email,
        title:       "✅ Support: We've received your message",
        body:
          "Thank you for reaching out to us. We have received your message and our team " +
          "is currently reviewing your concern. We will get back to you as soon as possible. " +
          "– FinGuard Support Team",
      });
      setAckStatus("done");
      if (onAckSent) onAckSent();
    } catch (err) {
      console.error("[FinGuard] Ack error:", err);
      setAckStatus("error");
      setTimeout(() => setAckStatus("idle"), 3000);
    }
  };

  if (alreadyReplied || ackStatus === "done") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <CheckCircleIcon sx={{ fontSize: 14, color: "#34D399" }} />
        <Typography sx={{ fontSize: "0.72rem", color: "#34D399", fontWeight: 700 }}>
          Replied
        </Typography>
      </Box>
    );
  }

  return (
    <Tooltip title="Send an automated acknowledgement to the user in-app">
      <Button
        size="small"
        variant="contained"
        onClick={handleAck}
        disabled={ackStatus === "loading"}
        startIcon={
          ackStatus === "loading"
            ? <CircularProgress size={12} color="inherit" />
            : <BoltIcon sx={{ fontSize: 14 }} />
        }
        sx={{
          fontSize: "0.7rem",
          py: 0.4, px: 1.2,
          height: 26,
          background: "linear-gradient(135deg, #2DD4BF, #0D9488)",
          color: "#FFF",
          fontWeight: 700,
          boxShadow: "0 2px 8px rgba(45,212,191,0.3)",
          textTransform: "none",
          "&:hover": { background: "linear-gradient(135deg, #0D9488, #0F766E)", boxShadow: "0 4px 12px rgba(45,212,191,0.45)" },
          "&:disabled": { opacity: 0.6 },
        }}
      >
        {ackStatus === "loading" ? "Sending..." : "Send Ack"}
      </Button>
    </Tooltip>
  );
}

// ─── Single notification item ─────────────────────────────────────────────────
function NotifItem({ notif, onMarkRead, onReplyClick, onAckSent }) {
  const cfg        = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
  const isComplaint = notif.type === "complaint";

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        px: 3,
        pt: 2,
        pb: isComplaint ? 1.5 : 2,
        cursor: notif.read && !isComplaint ? "default" : "pointer",
        background: notif.read ? "transparent" : "rgba(45,212,191,0.03)",
        borderLeft: notif.read ? "3px solid transparent" : `3px solid ${cfg.color}`,
        transition: "background 0.2s",
        "&:hover": { background: "rgba(255,255,255,0.03)" },
      }}
    >
      {/* Icon bubble */}
      <Box
        onClick={() => !notif.read && !isComplaint && onMarkRead(notif.id)}
        sx={{
          width: 34, height: 34, borderRadius: "50%",
          background: cfg.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: cfg.color, flexShrink: 0, mt: 0.3,
        }}
      >
        {cfg.icon}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <Box
          onClick={() => !notif.read && !isComplaint && onMarkRead(notif.id)}
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}
        >
          <Typography
            sx={{
              color: notif.read ? "#64748B" : "#F0F6FF",
              fontSize: "0.85rem",
              fontWeight: notif.read ? 400 : 600,
              lineHeight: 1.4,
            }}
          >
            {notif.title}
          </Typography>
          {!notif.read && (
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, flexShrink: 0, mt: 0.6 }} />
          )}
        </Box>

        {/* Body */}
        <Typography
          onClick={() => !notif.read && !isComplaint && onMarkRead(notif.id)}
          sx={{ color: "#475569", fontSize: "0.78rem", mt: 0.3, lineHeight: 1.4 }}
        >
          {notif.body}
        </Typography>

        {/* Sender email */}
        {notif.email && (
          <Typography sx={{ color: cfg.color, fontSize: "0.7rem", mt: 0.3, fontWeight: 600 }}>
            From: {notif.email}
          </Typography>
        )}

        {/* Timestamp */}
        <Typography sx={{ color: "#334155", fontSize: "0.72rem", mt: 0.5 }}>
          {relativeTime(notif.createdAt)}
        </Typography>

        {/* ── Complaint action buttons ────────────────────────────────── */}
        {isComplaint && (
          <Box
            sx={{
              display: "flex", alignItems: "center", gap: 1, mt: 1.5,
              pt: 1.5,
              borderTop: "1px solid rgba(244,114,182,0.1)",
              flexWrap: "wrap",
            }}
          >
            {/* 1-click auto-acknowledgement */}
            <AckButton complaint={notif} onAckSent={onAckSent} />

            {/* Detailed reply — only while not yet replied */}
            {!notif.replied && (
              <Tooltip title="Write a custom detailed reply">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onReplyClick(notif)}
                  startIcon={<ReplyIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    fontSize: "0.7rem",
                    py: 0.4, px: 1.2,
                    height: 26,
                    color: "#6366F1",
                    borderColor: "rgba(99,102,241,0.4)",
                    textTransform: "none",
                    "&:hover": {
                      borderColor: "#6366F1",
                      background: "rgba(99,102,241,0.08)",
                    },
                  }}
                >
                  Write Reply
                </Button>
              </Tooltip>
            )}

            {/* Mark as read */}
            {!notif.read && (
              <Button
                size="small"
                onClick={() => onMarkRead(notif.id)}
                sx={{
                  fontSize: "0.7rem",
                  py: 0.4, px: 1,
                  height: 26,
                  color: "#475569",
                  textTransform: "none",
                  "&:hover": { color: "#F0F6FF", background: "rgba(255,255,255,0.05)" },
                }}
              >
                Mark read
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function NotificationsPanel() {
  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [replyTarget, setReplyTarget]     = useState(null);
  const [ackSnackOpen, setAckSnackOpen]   = useState(false);

  // Real-time Firestore listener
  useEffect(() => {
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(list);
      setLoading(false);
    }, (err) => {
      console.error("[FinGuard] Notifications listener error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = async (id) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error("[FinGuard] markRead error:", err);
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach(n => batch.update(doc(db, "notifications", n.id), { read: true }));
      await batch.commit();
    } catch (err) {
      console.error("[FinGuard] markAllRead error:", err);
    }
  };

  // Split notifications into categories
  const complaints        = notifications.filter(n => n.type === "complaint");
  const otherNotifs       = notifications.filter(n => n.type !== "complaint");
  const unreadOthers      = otherNotifs.filter(n => !n.read);
  const readOthers        = otherNotifs.filter(n => n.read);
  const openComplaints    = complaints.filter(n => !n.replied);
  const repliedComplaints = complaints.filter(n => n.replied);

  return (
    <>
      {/* Bell button in AppBar */}
      <Tooltip title="Notifications">
        <IconButton
          id="notificationsBellBtn"
          aria-label="Open notifications"
          onClick={() => setOpen(true)}
          sx={{ color: "#94A3B8", "&:hover": { color: "#2DD4BF" } }}
        >
          <Badge
            badgeContent={unreadCount || null}
            color="error"
            sx={{ "& .MuiBadge-badge": { fontSize: "0.65rem", minWidth: 16, height: 16, padding: "0 4px" } }}
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
            width: { xs: "100vw", sm: 420 },
            background: "#0D1B2A",
            borderLeft: "1px solid rgba(45,212,191,0.12)",
            display: "flex", flexDirection: "column",
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 3, py: 2.5,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid rgba(45,212,191,0.1)",
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(13,27,42,0.95)",
          backdropFilter: "blur(12px)",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <NotificationsIcon sx={{ color: "#2DD4BF", fontSize: 20 }} />
            <Typography fontWeight={700} sx={{ color: "#F0F6FF", fontSize: "1rem" }}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} new`}
                size="small"
                sx={{ background: "rgba(45,212,191,0.15)", color: "#2DD4BF", fontWeight: 700, fontSize: "0.7rem", height: 20 }}
              />
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {unreadCount > 0 && (
              <Tooltip title="Mark all as read">
                <IconButton
                  size="small"
                  onClick={markAllRead}
                  id="markAllReadBtn"
                  sx={{ color: "#475569", "&:hover": { color: "#2DD4BF" } }}
                >
                  <DoneAllIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
              sx={{ color: "#475569", "&:hover": { color: "#F87171" } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
              <CircularProgress color="primary" size={28} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ textAlign: "center", pt: 10, px: 3 }}>
              <InboxIcon sx={{ fontSize: 52, color: "#1E3A5F", mb: 2 }} />
              <Typography sx={{ color: "#475569", fontSize: "0.9rem", fontWeight: 500 }}>
                No notifications yet
              </Typography>
              <Typography sx={{ color: "#334155", fontSize: "0.78rem", mt: 0.5 }}>
                Add documents to the{" "}
                <Box component="span" sx={{ color: "#2DD4BF", fontFamily: "monospace" }}>
                  notifications
                </Box>{" "}
                collection in Firestore.
              </Typography>
            </Box>
          ) : (
            <>
              {/* ── Open complaints ────────────────────────────────────── */}
              {openComplaints.length > 0 && (
                <>
                  <Box sx={{
                    px: 3, pt: 2.5, pb: 1,
                    display: "flex", alignItems: "center", gap: 1,
                  }}>
                    <Typography sx={{ color: "#F472B6", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      User Complaints
                    </Typography>
                    <Chip
                      label={`${openComplaints.length} open`}
                      size="small"
                      sx={{ background: "rgba(244,114,182,0.12)", color: "#F472B6", fontSize: "0.65rem", fontWeight: 700, height: 18 }}
                    />
                  </Box>
                  {openComplaints.map(n => (
                    <NotifItem
                      key={n.id}
                      notif={n}
                      onMarkRead={markRead}
                      onReplyClick={setReplyTarget}
                      onAckSent={() => setAckSnackOpen(true)}
                    />
                  ))}
                  <Divider sx={{ borderColor: "rgba(244,114,182,0.08)", my: 1 }} />
                </>
              )}

              {/* ── Replied complaints ─────────────────────────────────── */}
              {repliedComplaints.length > 0 && (
                <>
                  <Box sx={{ px: 3, pt: 1.5, pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ color: "#34D399", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Replied Complaints
                    </Typography>
                    <Chip
                      label={`${repliedComplaints.length}`}
                      size="small"
                      sx={{ background: "rgba(52,211,153,0.1)", color: "#34D399", fontSize: "0.65rem", fontWeight: 700, height: 18 }}
                    />
                  </Box>
                  {repliedComplaints.map(n => (
                    <NotifItem
                      key={n.id}
                      notif={n}
                      onMarkRead={markRead}
                      onReplyClick={setReplyTarget}
                      onAckSent={() => setAckSnackOpen(true)}
                    />
                  ))}
                  <Divider sx={{ borderColor: "rgba(52,211,153,0.08)", my: 1 }} />
                </>
              )}

              {/* ── Unread regular notifications ───────────────────────── */}
              {unreadOthers.length > 0 && (
                <>
                  <Typography sx={{ px: 3, pt: 2.5, pb: 1, color: "#475569", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Unread
                  </Typography>
                  {unreadOthers.map(n => (
                    <NotifItem key={n.id} notif={n} onMarkRead={markRead} onReplyClick={setReplyTarget} onAckSent={() => {}} />
                  ))}
                  <Divider sx={{ borderColor: "rgba(45,212,191,0.07)", my: 1 }} />
                </>
              )}

              {/* ── Read regular notifications ─────────────────────────── */}
              {readOthers.length > 0 && (
                <>
                  <Typography sx={{ px: 3, pt: 1.5, pb: 1, color: "#334155", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Earlier
                  </Typography>
                  {readOthers.map(n => (
                    <NotifItem key={n.id} notif={n} onMarkRead={markRead} onReplyClick={setReplyTarget} onAckSent={() => {}} />
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
            borderTop: "1px solid rgba(45,212,191,0.08)",
            background: "rgba(7,13,24,0.6)",
          }}>
            <Typography sx={{ color: "#334155", fontSize: "0.75rem", textAlign: "center" }}>
              {notifications.length} total &middot; {unreadCount} unread &middot; {openComplaints.length} open complaints
            </Typography>
          </Box>
        )}
      </Drawer>

      {/* Reply dialog */}
      <ReplyDialog
        open={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        complaint={replyTarget}
        onReplySent={() => setReplyTarget(null)}
      />

      {/* Acknowledgement success snackbar */}
      <Snackbar
        open={ackSnackOpen}
        autoHideDuration={3000}
        onClose={() => setAckSnackOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          onClose={() => setAckSnackOpen(false)}
          sx={{
            background: "rgba(45,212,191,0.12)", color: "#2DD4BF",
            border: "1px solid rgba(45,212,191,0.25)",
            "& .MuiAlert-icon": { color: "#2DD4BF" },
          }}
        >
          Acknowledgement sent! The user will see it in their app.
        </Alert>
      </Snackbar>
    </>
  );
}
