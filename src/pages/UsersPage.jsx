import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, TextField,
  InputAdornment, IconButton, Tooltip, Grid, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  MenuItem, Select, FormControl, InputLabel, Menu, ListItemIcon,
  ListItemText, Snackbar, Alert, Divider, Stack,
} from '@mui/material';
import SearchIcon           from '@mui/icons-material/Search';
import FilterListIcon       from '@mui/icons-material/FilterList';
import MoreVertIcon         from '@mui/icons-material/MoreVert';
import PersonAddIcon        from '@mui/icons-material/PersonAdd';
import EditIcon             from '@mui/icons-material/Edit';
import DeleteIcon           from '@mui/icons-material/Delete';
import BlockIcon            from '@mui/icons-material/Block';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import InboxIcon            from '@mui/icons-material/Inbox';
import CloseIcon            from '@mui/icons-material/Close';
import { db } from '../data/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  createUser, updateUser, deleteUser,
  ROLES, STATUSES, getRoleMeta, getStatusMeta,
} from '../data/userService';

// ── Avatar colour palette ────────────────────────────────────────────────────
const AVATAR_COLORS = ['#2DD4BF','#6366F1','#34D399','#FBBF24','#F472B6','#FB923C','#A78BFA','#38BDF8'];

// ── Shared field style for dialogs ───────────────────────────────────────────
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    background: 'rgba(255,255,255,0.03)',
    '& fieldset': { borderColor: 'rgba(45,212,191,0.15)' },
    '&:hover fieldset': { borderColor: 'rgba(45,212,191,0.35)' },
    '&.Mui-focused fieldset': { borderColor: '#2DD4BF' },
  },
  '& .MuiInputLabel-root': { color: '#64748B' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#2DD4BF' },
  '& input': { color: '#F0F6FF' },
};

// ── Initial form state ───────────────────────────────────────────────────────
const EMPTY_FORM = { displayName: '', email: '', password: '', role: 'Student', phone: '', status: 'active' };

// ─────────────────────────────────────────────────────────────────────────────
// Create / Edit Dialog
// ─────────────────────────────────────────────────────────────────────────────
function UserFormDialog({ open, onClose, onSave, initialData, isEdit }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(isEdit && initialData
        ? { ...EMPTY_FORM, ...initialData, password: '' }
        : EMPTY_FORM
      );
      setErrors({});
    }
  }, [open, isEdit, initialData]);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.displayName.trim())   errs.displayName = 'Name is required.';
    if (!form.email.trim())         errs.email       = 'Email is required.';
    if (!isEdit && form.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(145deg, #0D1B2A, #111C2D)',
          border: '1px solid rgba(45,212,191,0.12)',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#F0F6FF' }}>
          {isEdit ? 'Edit User' : 'Create New User'}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: '#475569' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider sx={{ borderColor: 'rgba(45,212,191,0.1)' }} />

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2.5}>
          {/* Full Name */}
          <TextField
            id="user-form-name"
            label="Full Name"
            value={form.displayName}
            onChange={set('displayName')}
            error={!!errors.displayName}
            helperText={errors.displayName}
            fullWidth size="small" sx={fieldSx}
          />

          {/* Email */}
          <TextField
            id="user-form-email"
            label="Email Address"
            type="email"
            value={form.email}
            onChange={set('email')}
            error={!!errors.email}
            helperText={errors.email}
            fullWidth size="small" sx={fieldSx}
          />

          {/* Password — only shown on create */}
          {!isEdit && (
            <TextField
              id="user-form-password"
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              error={!!errors.password}
              helperText={errors.password || 'Minimum 8 characters'}
              fullWidth size="small" sx={fieldSx}
            />
          )}

          {/* Phone */}
          <TextField
            id="user-form-phone"
            label="Phone (optional)"
            value={form.phone}
            onChange={set('phone')}
            fullWidth size="small" sx={fieldSx}
          />

          {/* Role */}
          <FormControl fullWidth size="small" sx={fieldSx}>
            <InputLabel id="user-form-role-label">Role</InputLabel>
            <Select
              labelId="user-form-role-label"
              id="user-form-role"
              value={form.role}
              label="Role"
              onChange={set('role')}
              sx={{ color: '#F0F6FF' }}
              MenuProps={{ PaperProps: { sx: { background: '#0D1B2A', border: '1px solid rgba(45,212,191,0.15)' } } }}
            >
              {ROLES.map(r => (
                <MenuItem key={r.value} value={r.value} sx={{ color: r.color }}>
                  {r.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Status — only shown on edit */}
          {isEdit && (
            <FormControl fullWidth size="small" sx={fieldSx}>
              <InputLabel id="user-form-status-label">Status</InputLabel>
              <Select
                labelId="user-form-status-label"
                id="user-form-status"
                value={form.status}
                label="Status"
                onChange={set('status')}
                sx={{ color: '#F0F6FF' }}
                MenuProps={{ PaperProps: { sx: { background: '#0D1B2A', border: '1px solid rgba(45,212,191,0.15)' } } }}
              >
                {STATUSES.map(s => (
                  <MenuItem key={s.value} value={s.value} sx={{ color: s.color }}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, pt: 1.5, gap: 1.5 }}>
        <Button
          id="user-form-cancel"
          onClick={onClose}
          sx={{ color: '#64748B', '&:hover': { background: 'rgba(100,116,139,0.08)' } }}
        >
          Cancel
        </Button>
        <Button
          id="user-form-save"
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            background: 'linear-gradient(135deg, #2DD4BF, #0D9488)',
            color: '#0D1B2A',
            fontWeight: 700,
            px: 3,
            '&:hover': { background: 'linear-gradient(135deg, #5EEAD4, #0D9488)' },
            '&.Mui-disabled': { opacity: 0.5 },
          }}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Confirmation Dialog
// ─────────────────────────────────────────────────────────────────────────────
function DeleteDialog({ open, user, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(145deg, #0D1B2A, #111C2D)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle>
        <Typography fontWeight={700} sx={{ color: '#F87171' }}>Deactivate User</Typography>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: '#94A3B8', fontSize: '0.9rem' }}>
          Are you sure you want to deactivate{' '}
          <Box component="span" sx={{ color: '#F0F6FF', fontWeight: 600 }}>
            {user?.name}
          </Box>
          ? Their account status will be set to <Box component="span" sx={{ color: '#F87171', fontWeight: 600 }}>Deactivated</Box> and they will lose access to the mobile app. You can reactivate them later by editing the user.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, gap: 1.5 }}>
        <Button
          id="delete-cancel"
          onClick={onClose}
          sx={{ color: '#64748B', '&:hover': { background: 'rgba(100,116,139,0.08)' } }}
        >
          Cancel
        </Button>
        <Button
          id="delete-confirm"
          variant="contained"
          onClick={handleConfirm}
          disabled={deleting}
          startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            background: 'rgba(248,113,113,0.15)',
            color: '#F87171',
            border: '1px solid rgba(248,113,113,0.3)',
            fontWeight: 700,
            '&:hover': { background: 'rgba(248,113,113,0.25)' },
            '&.Mui-disabled': { opacity: 0.5 },
          }}
        >
          {deleting ? 'Deactivating…' : 'Deactivate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Users Page
// ─────────────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Row action menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuUser,   setMenuUser]   = useState(null);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Snackbar feedback
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  // ── Real-time Firestore listener ──────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id:           doc.id,
            name:         d.name         || d.fullName || 'Anonymous User',
            email:        d.email        || '',
            phone:        d.phone        || d.mobile   || '',
            role:         d.role         || 'Student',
            plan:         d.plan         || 'Free',
            balance:      typeof d.balance      === 'number' ? d.balance      : Number(d.balance      || 0),
            transactions: typeof d.transactions === 'number' ? d.transactions : Number(d.transactions || 0),
            joined:       d.joined       || '',
            status:       d.status       || 'active',
          };
        });
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        console.error('[FinGuard] Error loading users:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalUsers     = users.length;
  const activeCount    = users.filter(u => u.status === 'active').length;
  const suspendedCount = users.filter(u => u.status === 'suspended').length;

  const roleCounts = ROLES.reduce((acc, r) => {
    acc[r.value] = users.filter(u => u.role === r.value).length;
    return acc;
  }, {});

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const matchesSearch = (
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // ── Row menu handlers ─────────────────────────────────────────────────────
  const openMenu  = (e, user) => { setMenuAnchor(e.currentTarget); setMenuUser(user); };
  const closeMenu = () => { setMenuAnchor(null); setMenuUser(null); };

  const handleEditOpen = () => {
    setEditTarget(menuUser);
    setEditOpen(true);
    closeMenu();
  };

  const handleDeleteOpen = () => {
    setDeleteTarget(menuUser);
    setDeleteOpen(true);
    closeMenu();
  };

  const handleToggleSuspend = async () => {
    if (!menuUser) return;
    const newStatus = menuUser.status === 'suspended' ? 'active' : 'suspended';
    closeMenu();
    try {
      await updateUser({ uid: menuUser.id, status: newStatus });
      showSnack(`User ${newStatus === 'suspended' ? 'suspended' : 'reactivated'} successfully.`);
    } catch (err) {
      showSnack(err.message || 'Failed to update status.', 'error');
    }
  };

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const handleCreate = useCallback(async (form) => {
    try {
      await createUser({
        email:       form.email,
        password:    form.password,
        displayName: form.displayName,
        role:        form.role,
        phone:       form.phone,
      });
      showSnack(`User "${form.displayName}" created successfully!`);
    } catch (err) {
      showSnack(err.message || 'Failed to create user.', 'error');
      throw err; // keep dialog open on error
    }
  }, []);

  const handleUpdate = useCallback(async (form) => {
    try {
      await updateUser({
        uid:         editTarget.id,
        displayName: form.displayName,
        email:       form.email,
        role:        form.role,
        status:      form.status,
        phone:       form.phone,
      });
      showSnack(`User "${form.displayName}" updated successfully!`);
    } catch (err) {
      showSnack(err.message || 'Failed to update user.', 'error');
      throw err;
    }
  }, [editTarget]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteUser(deleteTarget.id);
      showSnack(`User "${deleteTarget.name}" deleted.`);
    } catch (err) {
      showSnack(err.message || 'Failed to delete user.', 'error');
      throw err;
    }
  }, [deleteTarget]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '70vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#F0F6FF', letterSpacing: '-0.02em' }}>Users</Typography>
          <Typography sx={{ color: '#64748B', mt: 0.5 }}>{filtered.length} of {totalUsers} registered users</Typography>
        </Box>
        <Chip
          id="add-user-btn"
          icon={<PersonAddIcon sx={{ fontSize: '16px !important' }} />}
          label="Add User"
          clickable
          onClick={() => setCreateOpen(true)}
          sx={{
            background: 'linear-gradient(135deg,#2DD4BF,#0D9488)',
            color: '#0D1B2A',
            fontWeight: 700,
            px: 1,
            py: 2.5,
            border: 'none',
            fontSize: '0.85rem',
            '&:hover': { opacity: 0.9, transform: 'translateY(-1px)', transition: 'all 0.2s' },
          }}
        />
      </Box>

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Total Users',  value: totalUsers,     color: '#2DD4BF' },
          { label: 'Active',       value: activeCount,    color: '#34D399' },
          { label: 'Suspended',    value: suspendedCount, color: '#F87171' },
          ...ROLES.filter(r => r.value !== 'admin').map(r => ({
            label: r.label,
            value: roleCounts[r.value] || 0,
            color: r.color,
          })),
        ].map(({ label, value, color }) => (
          <Grid item xs={6} md={3} lg={2} key={label}>
            <Card elevation={0}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography sx={{ color: '#64748B', fontSize: '0.78rem', mb: 0.5 }}>{label}</Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color }}>{value.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Table Card ──────────────────────────────────────────────────── */}
      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>

          {/* Search + Role filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              id="users-search"
              size="small"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: '1 1 240px', ...fieldSx }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#475569', fontSize: 18 }} /></InputAdornment>,
              }}
            />

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <FilterListIcon sx={{ color: '#475569', fontSize: 18 }} />
              {[{ value: 'all', label: 'All' }, ...ROLES].map(r => (
                <Chip
                  key={r.value}
                  id={`role-filter-${r.value}`}
                  label={r.label || r.value}
                  size="small"
                  clickable
                  onClick={() => setRoleFilter(r.value)}
                  sx={{
                    background: roleFilter === r.value
                      ? (r.color ? `rgba(${hexToRgb(r.color)},0.2)` : 'rgba(45,212,191,0.2)')
                      : 'rgba(255,255,255,0.04)',
                    color: roleFilter === r.value ? (r.color || '#2DD4BF') : '#64748B',
                    border: `1px solid ${roleFilter === r.value ? (r.color || '#2DD4BF') : 'rgba(255,255,255,0.08)'}`,
                    fontWeight: roleFilter === r.value ? 700 : 400,
                    fontSize: '0.72rem',
                    transition: 'all 0.2s',
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Table */}
          {filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <InboxIcon sx={{ fontSize: 48, color: '#334155', mb: 1.5 }} />
              <Typography sx={{ color: '#475569', fontSize: '0.9rem' }}>
                {search || roleFilter !== 'all' ? 'No users match your filters.' : 'No users found in Firestore yet.'}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ background: 'transparent' }}>
              <Table aria-label="users table">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Joined</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((user, i) => {
                    const roleMeta   = getRoleMeta(user.role);
                    const statusMeta = getStatusMeta(user.status);
                    return (
                      <TableRow key={user.id} sx={{ '&:hover': { background: 'rgba(45,212,191,0.03)' }, transition: 'background 0.15s' }}>

                        {/* User cell */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 36, height: 36, fontSize: '0.85rem', fontWeight: 700, background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                              {user.name[0]}
                            </Avatar>
                            <Box>
                              <Typography sx={{ color: '#F0F6FF', fontSize: '0.88rem', fontWeight: 600 }}>{user.name}</Typography>
                              <Typography sx={{ color: '#475569', fontSize: '0.72rem' }}>{user.email}</Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Role chip */}
                        <TableCell>
                          <Chip
                            label={roleMeta.label}
                            size="small"
                            sx={{ background: roleMeta.bg, color: roleMeta.color, border: `1px solid ${roleMeta.border}`, fontWeight: 600, fontSize: '0.72rem' }}
                          />
                        </TableCell>

                        {/* Plan */}
                        <TableCell>
                          <Typography sx={{ color: '#94A3B8', fontSize: '0.82rem' }}>{user.plan}</Typography>
                        </TableCell>

                        {/* Joined */}
                        <TableCell>
                          <Typography sx={{ color: '#64748B', fontSize: '0.8rem' }}>{user.joined}</Typography>
                        </TableCell>

                        {/* Status chip */}
                        <TableCell>
                          <Chip
                            label={statusMeta.label}
                            size="small"
                            sx={{ background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.border}`, fontWeight: 600, fontSize: '0.72rem' }}
                          />
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="center">
                          <Tooltip title="Actions">
                            <IconButton
                              id={`user-menu-${user.id}`}
                              size="small"
                              onClick={(e) => openMenu(e, user)}
                              sx={{ color: '#475569', '&:hover': { color: '#2DD4BF' } }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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

      {/* ── Row Action Menu ──────────────────────────────────────────────── */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        PaperProps={{
          sx: {
            background: '#0D1B2A',
            border: '1px solid rgba(45,212,191,0.12)',
            borderRadius: 2,
            minWidth: 180,
          },
        }}
      >
        {menuUser?.role === 'admin' ? (
          <MenuItem disabled sx={{ color: '#475569', fontSize: '0.82rem', fontStyle: 'italic' }}>
            🔒 Admin accounts are protected
          </MenuItem>
        ) : (
          <>
            <MenuItem id="menu-edit" onClick={handleEditOpen} sx={{ color: '#94A3B8', '&:hover': { color: '#F0F6FF', background: 'rgba(45,212,191,0.06)' } }}>
              <ListItemIcon sx={{ color: 'inherit' }}><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Edit User</ListItemText>
            </MenuItem>

            <MenuItem
              id="menu-suspend"
              onClick={handleToggleSuspend}
              sx={{ color: '#94A3B8', '&:hover': { color: menuUser?.status === 'suspended' ? '#34D399' : '#FBBF24', background: 'rgba(251,191,36,0.06)' } }}
            >
              <ListItemIcon sx={{ color: 'inherit' }}>
                {menuUser?.status === 'suspended' ? <CheckCircleIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText>{menuUser?.status === 'suspended' ? 'Reactivate' : 'Suspend'}</ListItemText>
            </MenuItem>

            <Divider sx={{ borderColor: 'rgba(45,212,191,0.08)', my: 0.5 }} />

            <MenuItem id="menu-delete" onClick={handleDeleteOpen} sx={{ color: '#F87171', '&:hover': { background: 'rgba(248,113,113,0.08)' } }}>
              <ListItemIcon sx={{ color: 'inherit' }}><DeleteIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Deactivate</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* ── Create Dialog ────────────────────────────────────────────────── */}
      <UserFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        isEdit={false}
      />

      {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
      <UserFormDialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditTarget(null); }}
        onSave={handleUpdate}
        initialData={editTarget ? {
          displayName: editTarget.name,
          email:       editTarget.email,
          phone:       editTarget.phone,
          role:        editTarget.role,
          status:      editTarget.status,
        } : null}
        isEdit
      />

      {/* ── Delete Dialog ────────────────────────────────────────────────── */}
      <DeleteDialog
        open={deleteOpen}
        user={deleteTarget}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null); }}
        onConfirm={handleDelete}
      />

      {/* ── Snackbar Feedback ────────────────────────────────────────────── */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          sx={{ background: snack.severity === 'success' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: '#F0F6FF', border: `1px solid ${snack.severity === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ── Utility: convert hex colour to r,g,b for rgba() ─────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
