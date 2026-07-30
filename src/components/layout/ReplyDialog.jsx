/**
 * ReplyDialog.jsx
 * Admin dialog for composing a custom detailed reply to a user complaint.
 *
 * Option B: writes directly to Firestore (no Cloud Functions needed).
 * Steps:
 *   1. Query users collection by complaint.email to resolve the user UID
 *   2. addDoc to notifications with type:"admin_reply", uid, isUserTargeted:true
 *   3. updateDoc on the original complaint — sets replied:true
 */
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, IconButton,
  Collapse, Alert, CircularProgress, Chip, Divider,
  Snackbar,
} from "@mui/material";
import CloseIcon        from "@mui/icons-material/Close";
import SendIcon         from "@mui/icons-material/Send";
import ExpandMoreIcon   from "@mui/icons-material/ExpandMore";
import ExpandLessIcon   from "@mui/icons-material/ExpandLess";
import ReplyIcon        from "@mui/icons-material/Reply";
import EmailIcon        from "@mui/icons-material/Email";
import { db }          from "../../data/firebase";
import {
  collection, query, where, limit, getDocs,
  addDoc, setDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";

const MAX_MSG_LEN = 2000;

async function resolveUidByEmail(email) {
  if (!email) return null;
  try {
    // Fetch all users and find match client-side to bypass Firestore case-sensitivity
    const snap = await getDocs(collection(db, "users"));
    const target = email.toLowerCase().trim();
    const userDoc = snap.docs.find(d => {
      const uEmail = d.data().email || "";
      return uEmail.toLowerCase().trim() === target;
    });
    return userDoc ? userDoc.id : null;
  } catch (err) {
    console.error("[FinGuard] resolveUidByEmail error:", err);
    return null;
  }
}

export default function ReplyDialog({ open, onClose, complaint, onReplySent }) {
  const [subject,      setSubject]      = useState("Re: Your Complaint");
  const [message,      setMessage]      = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [status,       setStatus]       = useState("idle"); // idle | loading | error
  const [errorMsg,     setErrorMsg]     = useState("");
  const [snackOpen,    setSnackOpen]    = useState(false);

  const charsLeft = MAX_MSG_LEN - message.length;

  const handleClose = () => {
    if (status === "loading") return;
    setSubject("Re: Your Complaint");
    setMessage("");
    setShowOriginal(false);
    setStatus("idle");
    setErrorMsg("");
    onClose();
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      // 1. Resolve user UID from the complaint email
      const targetUid = await resolveUidByEmail(complaint.email);

      if (!targetUid) {
        throw new Error("Cannot reply: No mobile app user found with this email.");
      }

      // 2. Write the reply notification to the user's specific notifications subcollection
      const newNotifRef = doc(collection(db, "users", targetUid, "notifications"));
      await setDoc(newNotifRef, {
        id:                 newNotifRef.id,
        title:              subject.trim() || "Message from FinGuard Support",
        message:            message.trim(),
        type:               "system",
        isRead:             false,
        read:               false,
        studentId:          targetUid,
        severity:           "info",
        sourceModule:       "Support",
        relatedEntityId:    complaint.id,
        createdAt:          Date.now(),
      });

      // 3. Mark the original complaint as replied
      await updateDoc(doc(db, "notifications", complaint.id), {
        replied:   true,
        repliedAt: serverTimestamp(),
      });

      setSnackOpen(true);
      if (onReplySent) onReplySent();
      setTimeout(() => handleClose(), 1500);
    } catch (err) {
      console.error("[FinGuard] ReplyDialog send error:", err);
      setStatus("error");
      setErrorMsg(err?.message || "Failed to send reply. Please try again.");
    }
  };

  if (!complaint) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background:     "linear-gradient(135deg, #0D1B2A 0%, #0A1628 100%)",
            border:         "1px solid rgba(99,102,241,0.25)",
            borderRadius:   3,
            backdropFilter: "blur(20px)",
            boxShadow:      "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)",
          },
        }}
      >
        {/* Header */}
        <DialogTitle
          sx={{
            px: 3, py: 2.5,
            borderBottom: "1px solid rgba(99,102,241,0.12)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(99,102,241,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ReplyIcon sx={{ color: "#6366F1", fontSize: 18 }} />
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize="1rem" color="#F0F6FF">
                Write Detailed Reply
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.2 }}>
                <EmailIcon sx={{ fontSize: 12, color: "#6366F1" }} />
                <Typography fontSize="0.75rem" color="#6366F1">
                  {complaint.email}
                </Typography>
              </Box>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={handleClose}
            disabled={status === "loading"}
            sx={{ color: "#475569", "&:hover": { color: "#F87171" } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        {/* Content */}
        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>

          {/* Original complaint collapsible preview */}
          <Box
            onClick={() => setShowOriginal(v => !v)}
            sx={{
              mb: 2.5, p: 1.5,
              borderRadius: 2,
              background: "rgba(244,114,182,0.06)",
              border: "1px solid rgba(244,114,182,0.15)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              transition: "background 0.2s",
              "&:hover": { background: "rgba(244,114,182,0.1)" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Chip
                label="Original Complaint"
                size="small"
                sx={{
                  background: "rgba(244,114,182,0.15)", color: "#F472B6",
                  fontSize: "0.68rem", fontWeight: 700, height: 20, flexShrink: 0,
                }}
              />
              {!showOriginal && (
                <Typography
                  sx={{
                    color: "#64748B", fontSize: "0.78rem",
                    overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", maxWidth: 240,
                  }}
                >
                  {complaint.body}
                </Typography>
              )}
            </Box>
            {showOriginal
              ? <ExpandLessIcon sx={{ fontSize: 18, color: "#F472B6", flexShrink: 0 }} />
              : <ExpandMoreIcon sx={{ fontSize: 18, color: "#64748B", flexShrink: 0 }} />}
          </Box>

          <Collapse in={showOriginal}>
            <Box
              sx={{
                mb: 2.5, p: 2,
                borderRadius: 2,
                background: "rgba(7,13,24,0.6)",
                border: "1px solid rgba(244,114,182,0.12)",
                borderLeft: "3px solid #F472B6",
              }}
            >
              <Typography sx={{ color: "#94A3B8", fontSize: "0.82rem", lineHeight: 1.6 }}>
                {complaint.body}
              </Typography>
            </Box>
          </Collapse>

          <Divider sx={{ borderColor: "rgba(99,102,241,0.1)", mb: 2.5 }} />

          {/* Subject */}
          <TextField
            label="Subject"
            fullWidth
            value={subject}
            onChange={e => setSubject(e.target.value)}
            disabled={status === "loading"}
            size="small"
            sx={{
              mb: 2.5,
              "& .MuiOutlinedInput-root": {
                color: "#F0F6FF",
                background: "rgba(99,102,241,0.05)",
                "& fieldset": { borderColor: "rgba(99,102,241,0.25)" },
                "&:hover fieldset": { borderColor: "rgba(99,102,241,0.5)" },
                "&.Mui-focused fieldset": { borderColor: "#6366F1" },
              },
              "& .MuiInputLabel-root": { color: "#64748B", "&.Mui-focused": { color: "#6366F1" } },
            }}
          />

          {/* Message */}
          <TextField
            label="Your Reply"
            multiline
            rows={6}
            fullWidth
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, MAX_MSG_LEN))}
            disabled={status === "loading"}
            placeholder="Write a clear, helpful response to the user's complaint..."
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "#F0F6FF",
                background: "rgba(99,102,241,0.05)",
                "& fieldset": { borderColor: "rgba(99,102,241,0.25)" },
                "&:hover fieldset": { borderColor: "rgba(99,102,241,0.5)" },
                "&.Mui-focused fieldset": { borderColor: "#6366F1" },
              },
              "& .MuiInputLabel-root": { color: "#64748B", "&.Mui-focused": { color: "#6366F1" } },
            }}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
            <Typography sx={{ fontSize: "0.72rem", color: charsLeft < 100 ? "#FBBF24" : "#334155" }}>
              {charsLeft} chars remaining
            </Typography>
          </Box>

          {status === "error" && (
            <Alert
              severity="error"
              sx={{
                mt: 2,
                background: "rgba(248,113,113,0.1)", color: "#F87171",
                "& .MuiAlert-icon": { color: "#F87171" }, fontSize: "0.82rem",
              }}
            >
              {errorMsg}
            </Alert>
          )}
        </DialogContent>

        {/* Actions */}
        <DialogActions sx={{ px: 3, py: 2.5, borderTop: "1px solid rgba(99,102,241,0.1)", gap: 1 }}>
          <Button
            onClick={handleClose}
            disabled={status === "loading"}
            sx={{ color: "#64748B", "&:hover": { color: "#F0F6FF", background: "rgba(255,255,255,0.05)" } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={status === "loading" || !message.trim()}
            variant="contained"
            startIcon={
              status === "loading"
                ? <CircularProgress size={16} color="inherit" />
                : <SendIcon sx={{ fontSize: 16 }} />
            }
            sx={{
              px: 3,
              background: "linear-gradient(135deg, #6366F1, #4338CA)",
              color: "#FFF", fontWeight: 700,
              boxShadow: "0 4px 15px rgba(99,102,241,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg, #4338CA, #3730A3)",
                boxShadow: "0 6px 20px rgba(99,102,241,0.5)",
              },
              "&:disabled": { opacity: 0.5, background: "linear-gradient(135deg, #6366F1, #4338CA)" },
            }}
          >
            {status === "loading" ? "Sending..." : "Send Reply"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success snackbar */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          onClose={() => setSnackOpen(false)}
          sx={{
            background: "rgba(52,211,153,0.15)", color: "#34D399",
            border: "1px solid rgba(52,211,153,0.25)",
            "& .MuiAlert-icon": { color: "#34D399" },
          }}
        >
          Reply sent! The user will see it in their app notifications.
        </Alert>
      </Snackbar>
    </>
  );
}
