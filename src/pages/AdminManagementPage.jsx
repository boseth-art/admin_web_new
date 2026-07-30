/**
 * AdminManagementPage.jsx
 * ────────────────────────
 * Full CRUD interface for managing admin accounts.
 * Only accessible by super admin.
 *
 * Features:
 *  - Table of all admin accounts with status badges
 *  - Create new admin dialog (Cloud Function)
 *  - Edit admin dialog (name / email / phone / status)
 *  - Revoke admin access (soft — strips role, sets status=revoked)
 *  - Delete admin account (hard — Auth + Firestore, with confirmation)
 *  - Search + filter by status
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Button,
  Avatar, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, CircularProgress, Tooltip,
  Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, InputAdornment, Select, MenuItem,
  FormControl, InputLabel, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import SearchIcon from '@mui/icons-material/Search';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ShieldIcon from '@mui/icons-material/Shield';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import {
  fetchAllAdmins,
  createAdminAccount,
  updateAdminAccount,
  revokeAdminAccess,
  deleteAdminAccount,
  writeAuditLog,
} from '../data/adminService';
import { sanitiseInput } from '../security/authSecurity';

// ── Gold palette ──────────────────────────────────────────────────────────────
const GOLD   = '#F59E0B';
const GOLD_D = '#D97706';
const GOLD_BG  = 'rgba(245,158,11,0.08)';
const GOLD_BRD = 'rgba(245,158,11,0.2)';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_META = {
  active:      { label: 'Active',      color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)' },
  suspended:   { label: 'Suspended',   color: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)' },
  revoked:     { label: 'Revoked',     color: '#F87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
  inactive:    { label: 'Inactive',    color: '#94A3B8', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' },
};

function StatusChip({ status }) {
  const m = STATUS_META[status] || STATUS_META.inactive;
  return (
    <Chip
      label={m.label}
      size="small"
      sx={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, fontWeight: 600, fontSize: '0.72rem' }}
    />
  );
}

// ── Gold Dialog wrapper ───────────────────────────────────────────────────────
function GoldDialog({ open, onClose, title, icon, children, actions, maxWidth = 'sm' }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(13,27,42,0.98)',
          border: `1px solid ${GOLD_BRD}`,
          backdropFilter: 'blur(24px)',
          borderRadius: 4,
        },
      }}
      BackdropProps={{ sx: { backdropFilter: 'blur(4px)', background: 'rgba(7,13,24,0.6)' } }}
    >
      <DialogTitle sx={{ color: '#F0F6FF', fontWeight: 700, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 0.75, borderRadius: 1.5, background: GOLD_BG, color: GOLD, display: 'flex' }}>{icon}</Box>
          {title}
        </Box>
      </DialogTitle>
      <Divider sx={{ borderColor: GOLD_BRD, mx: 3 }} />
      <DialogContent sx={{ pt: 2.5 }}>{children}</DialogContent>
      {actions && <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>{actions}</DialogActions>}
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminManagementPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [admins, setAdmins]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create dialog
  const [createOpen, setCreateOpen]   = useState(false);
  const [createForm, setCreateForm]   = useState({ email: '', password: '', displayName: '', phone: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg]     = useState({ type: '', text: '' });

  // Edit dialog
  const [editOpen, setEditOpen]       = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [editForm, setEditForm]       = useState({ displayName: '', email: '', phone: '', status: 'active' });
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg]         = useState({ type: '', text: '' });

  // Revoke dialog
  const [revokeOpen, setRevokeOpen]   = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeMsg, setRevokeMsg]     = useState({ type: '', text: '' });

  // Delete dialog
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg]     = useState({ type: '', text: '' });
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // ── Load admins ──────────────────────────────────────────────────────────
  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAllAdmins();
      setAdmins(list);
    } catch (err) {
      console.error('Fetch admins error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = admins.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Create Admin ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const { email, password, displayName, phone } = createForm;
    if (!email || !password || !displayName) {
      setCreateMsg({ type: 'error', text: 'Email, password, and display name are required.' });
      return;
    }
    if (password.length < 8) {
      setCreateMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setCreateLoading(true);
    setCreateMsg({ type: '', text: '' });
    try {
      const result = await createAdminAccount({
        email: sanitiseInput(email),
        password,
        displayName: sanitiseInput(displayName),
        phone: sanitiseInput(phone),
      });
      await writeAuditLog({
        action: 'ADMIN_CREATED',
        actorUid: user.uid, actorEmail: user.email,
        targetEmail: email,
        details: { displayName, uid: result?.uid },
      });
      setCreateMsg({ type: 'success', text: `Admin account for ${displayName} created successfully.` });
      setCreateForm({ email: '', password: '', displayName: '', phone: '' });
      loadAdmins();
    } catch (err) {
      setCreateMsg({ type: 'error', text: err.message || 'Failed to create admin account.' });
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Edit Admin ────────────────────────────────────────────────────────────
  const openEdit = (admin) => {
    setEditTarget(admin);
    setEditForm({ displayName: admin.name || '', email: admin.email || '', phone: admin.phone || '', status: admin.status || 'active' });
    setEditMsg({ type: '', text: '' });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    setEditMsg({ type: '', text: '' });
    try {
      await updateAdminAccount({
        uid:         editTarget.uid || editTarget.id,
        displayName: sanitiseInput(editForm.displayName),
        email:       sanitiseInput(editForm.email),
        phone:       sanitiseInput(editForm.phone),
        status:      editForm.status,
      });
      await writeAuditLog({
        action: 'ADMIN_UPDATED',
        actorUid: user.uid, actorEmail: user.email,
        targetUid: editTarget.uid || editTarget.id, targetEmail: editTarget.email,
        details: { status: editForm.status },
      });
      setEditMsg({ type: 'success', text: 'Admin account updated successfully.' });
      loadAdmins();
    } catch (err) {
      setEditMsg({ type: 'error', text: err.message || 'Failed to update admin account.' });
    } finally {
      setEditLoading(false);
    }
  };

  // ── Revoke Admin ──────────────────────────────────────────────────────────
  const openRevoke = (admin) => {
    setRevokeTarget(admin);
    setRevokeMsg({ type: '', text: '' });
    setRevokeOpen(true);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevokeLoading(true);
    setRevokeMsg({ type: '', text: '' });
    try {
      await revokeAdminAccess(revokeTarget.uid || revokeTarget.id);
      await writeAuditLog({
        action: 'ADMIN_REVOKED',
        actorUid: user.uid, actorEmail: user.email,
        targetUid: revokeTarget.uid || revokeTarget.id, targetEmail: revokeTarget.email,
      });
      setRevokeMsg({ type: 'success', text: `Admin access for ${revokeTarget.name} has been revoked.` });
      loadAdmins();
    } catch (err) {
      setRevokeMsg({ type: 'error', text: err.message || 'Failed to revoke admin access.' });
    } finally {
      setRevokeLoading(false);
    }
  };

  // ── Delete Admin ──────────────────────────────────────────────────────────
  const openDelete = (admin) => {
    setDeleteTarget(admin);
    setDeleteConfirm('');
    setDeleteMsg({ type: '', text: '' });
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirm !== deleteTarget.email) {
      setDeleteMsg({ type: 'error', text: 'Email confirmation does not match.' });
      return;
    }
    setDeleteLoading(true);
    setDeleteMsg({ type: '', text: '' });
    try {
      await deleteAdminAccount(deleteTarget.uid || deleteTarget.id);
      await writeAuditLog({
        action: 'ADMIN_DELETED',
        actorUid: user.uid, actorEmail: user.email,
        targetUid: deleteTarget.uid || deleteTarget.id, targetEmail: deleteTarget.email,
      });
      setDeleteMsg({ type: 'success', text: `Admin account deleted.` });
      setDeleteOpen(false);
      loadAdmins();
    } catch (err) {
      setDeleteMsg({ type: 'error', text: err.message || 'Failed to delete admin account.' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (v) => {
    try {
      const d = v?.toDate ? v.toDate() : new Date(v);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return '—'; }
  };

  return (
    <Box>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <Box sx={{
        mb: 4, p: 3, borderRadius: 3,
        background: `linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(13,27,42,0.5) 100%)`,
        border: `1px solid ${GOLD_BRD}`, backdropFilter: 'blur(20px)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <IconButton onClick={() => navigate('/super-admin')} sx={{ color: GOLD, border: `1px solid ${GOLD_BRD}`, borderRadius: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ p: 1.5, borderRadius: 3, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_D})`, display: 'flex', boxShadow: `0 6px 20px rgba(245,158,11,0.35)` }}>
            <SupervisorAccountIcon sx={{ color: '#0D1B2A', fontSize: 26 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>
                Admin Management
              </Typography>
              <Chip label={`${admins.length} Admin${admins.length !== 1 ? 's' : ''}`} size="small"
                sx={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BRD}`, fontWeight: 700 }} />
            </Box>
            <Typography sx={{ color: '#78716C', mt: 0.5 }}>Create, edit, suspend, revoke, or delete admin accounts</Typography>
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1.5 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={loadAdmins} sx={{ color: GOLD, border: `1px solid ${GOLD_BRD}`, borderRadius: 2 }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => { setCreateMsg({ type: '', text: '' }); setCreateOpen(true); }}
              sx={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_D})`, color: '#0D1B2A', fontWeight: 700, boxShadow: `0 4px 16px rgba(245,158,11,0.3)`, '&:hover': { background: `linear-gradient(135deg, #FCD34D, ${GOLD})`, transform: 'translateY(-1px)' } }}
            >
              New Admin
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── Search & Filter ───────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search by name or email…"
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#78716C', fontSize: 18 }} /></InputAdornment> }}
          sx={{ flex: 1, minWidth: 220 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="suspended">Suspended</MenuItem>
            <MenuItem value="revoked">Revoked</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* ── Admin Table ───────────────────────────────────────────────────── */}
      <Card elevation={0} sx={{ background: 'rgba(17,30,46,0.9)', border: `1px solid ${GOLD_BRD}`, backdropFilter: 'blur(20px)' }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: GOLD }} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <SupervisorAccountIcon sx={{ color: '#78716C', fontSize: 48, mb: 1 }} />
              <Typography sx={{ color: '#78716C' }}>
                {search || statusFilter !== 'all' ? 'No admins match your search.' : 'No admin accounts found.'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    {['Admin', 'Email', 'Status', 'Joined', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ color: '#78716C', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', background: 'rgba(245,158,11,0.05)' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(admin => (
                    <TableRow key={admin.id} sx={{ '&:hover': { background: 'rgba(245,158,11,0.03)' } }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 36, height: 36, background: `linear-gradient(135deg, #F87171, #DC2626)`, fontSize: '0.85rem', fontWeight: 700 }}>
                            {admin.name?.[0]?.toUpperCase() || 'A'}
                          </Avatar>
                          <Box>
                            <Typography sx={{ color: '#F0F6FF', fontSize: '0.88rem', fontWeight: 600 }}>{admin.name || '—'}</Typography>
                            <Typography sx={{ color: '#78716C', fontSize: '0.72rem' }}>{admin.phone || 'No phone'}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ color: '#94A3B8', fontSize: '0.85rem' }}>{admin.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={admin.status} />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ color: '#64748B', fontSize: '0.8rem' }}>{formatDate(admin.createdAt || admin.joined)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(admin)} sx={{ color: GOLD, '&:hover': { background: GOLD_BG } }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Revoke Access">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => openRevoke(admin)}
                                disabled={admin.status === 'revoked'}
                                sx={{ color: '#FBBF24', '&:hover': { background: 'rgba(251,191,36,0.08)' }, '&.Mui-disabled': { color: '#374151' } }}
                              >
                                <BlockIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Delete Account">
                            <IconButton size="small" onClick={() => openDelete(admin)} sx={{ color: '#F87171', '&:hover': { background: 'rgba(248,113,113,0.08)' } }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ════════════════ CREATE ADMIN DIALOG ════════════════════════════════ */}
      <GoldDialog
        open={createOpen}
        onClose={() => !createLoading && setCreateOpen(false)}
        title="Create Admin Account"
        icon={<PersonAddIcon fontSize="small" />}
        actions={
          <>
            <Button onClick={() => setCreateOpen(false)} disabled={createLoading} sx={{ color: '#64748B' }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={createLoading}
              startIcon={createLoading ? <CircularProgress size={16} sx={{ color: '#0D1B2A' }} /> : <ShieldIcon />}
              sx={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_D})`, color: '#0D1B2A', fontWeight: 700, boxShadow: `0 4px 16px rgba(245,158,11,0.3)` }}
            >
              {createLoading ? 'Creating…' : 'Create Admin'}
            </Button>
          </>
        }
      >
        {createMsg.text && (
          <Alert severity={createMsg.type || 'info'} onClose={() => setCreateMsg({ type: '', text: '' })} sx={{ mb: 2.5, borderRadius: 2 }}>
            {createMsg.text}
          </Alert>
        )}
        <Grid container spacing={2}>
          {[
            { key: 'displayName', label: 'Display Name',  type: 'text',     required: true },
            { key: 'email',       label: 'Email Address', type: 'email',    required: true },
            { key: 'password',    label: 'Password',       type: 'password', required: true, helper: 'Min. 8 characters' },
            { key: 'phone',       label: 'Phone Number',   type: 'tel',      required: false },
          ].map(f => (
            <Grid item xs={12} sm={6} key={f.key}>
              <TextField
                fullWidth size="small" label={f.label} type={f.type}
                value={createForm[f.key]}
                onChange={e => setCreateForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                required={f.required}
                helperText={f.helper}
                inputProps={{ maxLength: f.key === 'password' ? 128 : 80 }}
              />
            </Grid>
          ))}
        </Grid>
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
          <Typography sx={{ color: '#94A3B8', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <VerifiedUserIcon sx={{ fontSize: 14, color: '#F87171' }} />
            The created account will have <strong style={{ color: '#F87171' }}>&nbsp;admin&nbsp;</strong> role. Only super admins can create admin accounts.
          </Typography>
        </Box>
      </GoldDialog>

      {/* ════════════════ EDIT ADMIN DIALOG ══════════════════════════════════ */}
      <GoldDialog
        open={editOpen}
        onClose={() => !editLoading && setEditOpen(false)}
        title={`Edit — ${editTarget?.name || 'Admin'}`}
        icon={<EditIcon fontSize="small" />}
        actions={
          <>
            <Button onClick={() => setEditOpen(false)} disabled={editLoading} sx={{ color: '#64748B' }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleEdit}
              disabled={editLoading}
              startIcon={editLoading ? <CircularProgress size={16} sx={{ color: '#0D1B2A' }} /> : <AdminPanelSettingsIcon />}
              sx={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_D})`, color: '#0D1B2A', fontWeight: 700 }}
            >
              {editLoading ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      >
        {editMsg.text && (
          <Alert severity={editMsg.type || 'info'} onClose={() => setEditMsg({ type: '', text: '' })} sx={{ mb: 2.5, borderRadius: 2 }}>
            {editMsg.text}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Display Name" value={editForm.displayName}
              onChange={e => setEditForm(p => ({ ...p, displayName: e.target.value }))} inputProps={{ maxLength: 80 }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Email Address" type="email" value={editForm.email}
              onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} inputProps={{ maxLength: 120 }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Phone Number" type="tel" value={editForm.phone}
              onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} inputProps={{ maxLength: 20 }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={editForm.status} label="Status" onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </GoldDialog>

      {/* ════════════════ REVOKE DIALOG ═══════════════════════════════════════ */}
      <GoldDialog
        open={revokeOpen}
        onClose={() => !revokeLoading && setRevokeOpen(false)}
        title="Revoke Admin Access"
        icon={<BlockIcon fontSize="small" />}
        actions={
          <>
            <Button onClick={() => setRevokeOpen(false)} disabled={revokeLoading} sx={{ color: '#64748B' }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleRevoke}
              disabled={revokeLoading}
              startIcon={revokeLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <BlockIcon />}
              sx={{ background: 'linear-gradient(135deg, #FBBF24, #D97706)', color: '#0D1B2A', fontWeight: 700 }}
            >
              {revokeLoading ? 'Revoking…' : 'Revoke Access'}
            </Button>
          </>
        }
      >
        {revokeMsg.text ? (
          <Alert severity={revokeMsg.type || 'info'} sx={{ borderRadius: 2 }}>{revokeMsg.text}</Alert>
        ) : (
          <Box>
            <Typography sx={{ color: '#94A3B8', lineHeight: 1.7 }}>
              Are you sure you want to revoke admin access for{' '}
              <strong style={{ color: '#F0F6FF' }}>{revokeTarget?.name}</strong>{' '}
              (<span style={{ color: GOLD }}>{revokeTarget?.email}</span>)?
            </Typography>
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <Typography sx={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                This is a soft revoke — their Auth account will remain but their admin role will be stripped and status set to <strong style={{ color: '#FBBF24' }}>revoked</strong>.
                You can restore access by editing the account.
              </Typography>
            </Box>
          </Box>
        )}
      </GoldDialog>

      {/* ════════════════ DELETE DIALOG ═══════════════════════════════════════ */}
      <GoldDialog
        open={deleteOpen}
        onClose={() => !deleteLoading && setDeleteOpen(false)}
        title="Delete Admin Account"
        icon={<DeleteIcon fontSize="small" />}
        actions={
          <>
            <Button onClick={() => setDeleteOpen(false)} disabled={deleteLoading} sx={{ color: '#64748B' }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleDelete}
              disabled={deleteLoading || deleteConfirm !== deleteTarget?.email}
              startIcon={deleteLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <DeleteIcon />}
              sx={{ background: 'linear-gradient(135deg, #F87171, #DC2626)', color: '#fff', fontWeight: 700, boxShadow: '0 4px 16px rgba(248,113,113,0.3)' }}
            >
              {deleteLoading ? 'Deleting…' : 'Permanently Delete'}
            </Button>
          </>
        }
      >
        {deleteMsg.text && <Alert severity={deleteMsg.type || 'info'} sx={{ mb: 2, borderRadius: 2 }}>{deleteMsg.text}</Alert>}
        <Box sx={{ mb: 2.5, p: 2, borderRadius: 2, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <Typography sx={{ color: '#F87171', fontWeight: 700, mb: 0.5 }}>⚠ This action is irreversible</Typography>
          <Typography sx={{ color: '#94A3B8', fontSize: '0.82rem' }}>
            The Firebase Auth account and Firestore document for{' '}
            <strong style={{ color: '#F0F6FF' }}>{deleteTarget?.name}</strong> will be permanently deleted.
          </Typography>
        </Box>
        <Typography sx={{ color: '#94A3B8', fontSize: '0.85rem', mb: 1.5 }}>
          Type <strong style={{ color: '#F87171' }}>{deleteTarget?.email}</strong> to confirm:
        </Typography>
        <TextField
          fullWidth size="small"
          placeholder={deleteTarget?.email}
          value={deleteConfirm}
          onChange={e => setDeleteConfirm(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(248,113,113,0.3)' } }}
        />
      </GoldDialog>
    </Box>
  );
}
