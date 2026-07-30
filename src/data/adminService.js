/**
 * adminService.js
 * ────────────────
 * Super Admin–specific service layer.
 * All write operations call Cloud Functions (Admin SDK) for proper auth enforcement.
 * Read operations (listing admins, getting stats) hit Firestore directly.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection, query, where, getDocs, doc, getDoc,
  updateDoc, serverTimestamp, onSnapshot, orderBy, limit, addDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const functions = getFunctions();

// ─── Admin Account Operations (Cloud Function calls) ─────────────────────────

/**
 * Creates a new admin account.
 * Only callable by a super admin — enforced in the Cloud Function.
 */
export async function createAdminAccount({ email, password, displayName, phone = '' }) {
  const fn = httpsCallable(functions, 'superAdminCreateAdmin');
  const result = await fn({ email, password, displayName, phone });
  return result.data;
}

/**
 * Updates an existing admin's Firestore profile.
 */
export async function updateAdminAccount({ uid, displayName, email, phone, status }) {
  const fn = httpsCallable(functions, 'superAdminUpdateAdmin');
  const result = await fn({ uid, displayName, email, phone, status });
  return result.data;
}

/**
 * Soft-revokes an admin: strips the 'admin' role → sets 'revoked' status.
 * The Auth account remains but the JWT claim is cleared.
 */
export async function revokeAdminAccess(uid) {
  const fn = httpsCallable(functions, 'superAdminRevokeAdmin');
  const result = await fn({ uid });
  return result.data;
}

/**
 * Hard-deletes an admin's Auth account + Firestore document.
 * Cannot target self or another superadmin.
 */
export async function deleteAdminAccount(uid) {
  const fn = httpsCallable(functions, 'superAdminDeleteAdmin');
  const result = await fn({ uid });
  return result.data;
}

// ─── Read Operations (Firestore direct reads — super admin rules allow this) ──

/**
 * Fetches all users with role 'admin' from Firestore.
 * Returns an array of admin profile objects.
 */
export async function fetchAllAdmins() {
  const q = query(collection(db, 'users'), where('role', '==', 'admin'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetches system statistics for the Super Admin Control Panel.
 */
export async function fetchSystemStats() {
  const [usersSnap, txnsSnap, adminsSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'transactions')),
    getDocs(query(collection(db, 'users'), where('role', '==', 'admin'))),
  ]);

  const users = usersSnap.docs.map(d => d.data());
  const activeUsers  = users.filter(u => u.status === 'active').length;
  const totalRevenue = usersSnap.docs.reduce((sum, d) => sum + (Number(d.data().balance) || 0), 0);

  return {
    totalUsers:    usersSnap.size,
    activeUsers,
    totalAdmins:   adminsSnap.size,
    totalTxns:     txnsSnap.size,
    totalRevenue,
  };
}

/**
 * Fetches the global feature flags document.
 */
export async function fetchFeatureFlags() {
  const ref  = doc(db, 'featureFlags', 'global');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : {};
}

/**
 * Updates one or more feature flags in Firestore.
 * @param {object} flags — e.g. { maintenanceMode: true }
 * @param {string} updatedBy — uid of the super admin making the change
 */
export async function updateFeatureFlags(flags, updatedBy) {
  const ref = doc(db, 'featureFlags', 'global');
  await updateDoc(ref, {
    ...flags,
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}

/**
 * Fetches the last N audit log entries from Firestore.
 */
export async function fetchAuditLog(limitCount = 50) {
  const q = query(
    collection(db, 'auditLog'),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribes to real-time audit log updates.
 * @returns unsubscribe function
 */
export function subscribeAuditLog(callback, limitCount = 20) {
  const q = query(
    collection(db, 'auditLog'),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Writes an audit log entry when a super admin performs an action.
 */
export async function writeAuditLog({ action, actorUid, actorEmail, targetUid, targetEmail, details }) {
  await addDoc(collection(db, 'auditLog'), {
    action,
    actorUid,
    actorEmail,
    targetUid:   targetUid   || null,
    targetEmail: targetEmail || null,
    details:     details     || {},
    timestamp:   serverTimestamp(),
  });
}
