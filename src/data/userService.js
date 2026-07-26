/**
 * userService.js — Free Spark Plan Edition
 * ──────────────────────────────────────────
 * All user CRUD operations without Cloud Functions.
 *
 * CREATE:  createUserWithEmailAndPassword (Firebase client SDK, free)
 *          → signs out immediately → writes Firestore profile
 *          → admin re-signs in automatically (auth state preserved)
 *
 * UPDATE:  direct Firestore write under admin security rules
 *
 * SUSPEND/DEACTIVATE: sets status field in Firestore
 *          → mobile app checks status on login and denies access if not 'active'
 *
 * DELETE (soft): sets status='deactivated' in Firestore — no hard Auth deletion
 *          (hard Auth deletion requires Cloud Functions / Admin SDK)
 */

import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  doc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

// ── Role / Status metadata (shared with UI components) ───────────────────────

export const ROLES = [
  { value: 'Student',                 label: 'Student',              color: '#38BDF8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.2)'  },
  { value: 'Business owner',          label: 'Business Owner',       color: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)'  },
  { value: 'Company worker',          label: 'Company Worker',       color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
  { value: 'Multiple account holder', label: 'Multi Account Holder', color: '#FB923C', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.2)'  },
];

export const STATUSES = [
  { value: 'active',      label: 'Active',      color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.2)'  },
  { value: 'inactive',    label: 'Inactive',    color: '#94A3B8', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' },
  { value: 'suspended',   label: 'Suspended',   color: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)'  },
  { value: 'deactivated', label: 'Deactivated', color: '#F87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
];

// Admin is display-only — cannot be selected from any form dropdown.
const ADMIN_ROLE_META = { value: 'admin', label: 'Admin', color: '#F87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' };

export const getRoleMeta = (value) => {
  if (value === 'admin') return ADMIN_ROLE_META;
  const val = String(value || '').toLowerCase();
  if (val === 'student') return ROLES[0];
  if (val === 'business owner' || val === 'business_owner') return ROLES[1];
  if (val === 'company worker' || val === 'company owner' || val === 'company_owner') return ROLES[2];
  if (val === 'multiple account holder' || val === 'multi_account') return ROLES[3];
  return ROLES.find(r => r.value === value) || ROLES[0];
};
export const getStatusMeta = (value) => STATUSES.find(s => s.value === value) || STATUSES[0];

// ── CREATE USER ───────────────────────────────────────────────────────────────
/**
 * Creates a new Firebase Auth user and writes their Firestore profile.
 *
 * Strategy: We use a *secondary* Firebase app instance to create the new user
 * without disturbing the admin's current session. This avoids signing the
 * admin out during the creation flow.
 *
 * @param {object} data
 * @param {string} data.email
 * @param {string} data.password     (min 8 chars)
 * @param {string} data.displayName
 * @param {string} data.role         (student | business_owner | company_owner | multi_account)
 * @param {string} [data.phone]
 * @returns {Promise<{ uid: string }>}
 */
export async function createUser({ email, password, displayName, role, phone = '' }) {
  if (!email || !password || !displayName) {
    throw new Error('Email, password, and display name are required.');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  // Use a secondary named app instance so the admin session is never disturbed
  const secondaryApp = initializeApp(
    {
      apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
    },
    'secondary-user-creation'   // named — won't clash with the primary app
  );

  let newUid;
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const credential    = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    newUid              = credential.user.uid;
    await secondaryAuth.signOut();
  } catch (err) {
    throw translateAuthError(err);
  } finally {
    try { await deleteApp(secondaryApp); } catch (_) {}
  }

  // Write the unified Firestore profile matching both web and mobile schemas
  await setDoc(doc(db, 'users', newUid), {
    uid:          newUid,
    email,
    name:         displayName,
    fullName:     displayName, // For mobile app compatibility
    phone:        phone || '',
    mobile:       phone || '', // For mobile app compatibility
    role,
    plan:         'Free',
    status:       'active',
    balance:      0,
    transactions: 0,
    joined:       new Date().toISOString().split('T')[0],
    createdAt:    serverTimestamp(),
    createdBy:    auth.currentUser?.uid || 'admin',
    // Mobile app default fields to prevent crashes
    age:          "",
    hasLoan:      false,
    hasSavingPlan: false,
    loanAmount:   "",
    currentSavings: "",
    checkEmail:   false,
    checkSms:     false,
    checkPush:    false,
    checkReport:  false,
    checkPromo:   false,
  });

  // Setup Role-Specific Profiles via Subcollections (Pattern 1)
  let subcollectionName = '';
  const roleSpecificProfile = {};

  switch (role) {
    case 'Student':
      subcollectionName = 'student_profile';
      roleSpecificProfile.university = '';
      roleSpecificProfile.course = '';
      roleSpecificProfile.studentId = '';
      break;
    case 'Company worker':
      subcollectionName = 'worker_profile';
      roleSpecificProfile.companyName = '';
      roleSpecificProfile.designation = '';
      roleSpecificProfile.monthlySalary = 0.0;
      break;
    case 'Business owner':
      subcollectionName = 'business_profile';
      roleSpecificProfile.businessName = '';
      roleSpecificProfile.regNumber = '';
      roleSpecificProfile.industryType = '';
      break;
    case 'Multiple account holder':
      subcollectionName = 'multi_profile';
      roleSpecificProfile.linkedAccountsCount = 1;
      roleSpecificProfile.primaryWorkspace = '';
      break;
  }

  if (subcollectionName) {
    await setDoc(doc(db, 'users', newUid, subcollectionName, 'profile_data'), roleSpecificProfile);
  }

  return { uid: newUid };
}

// ── UPDATE USER ───────────────────────────────────────────────────────────────
/**
 * Updates a user's Firestore profile (name, email stored field, role, status, phone).
 * Note: this updates the Firestore document only — Firebase Auth displayName/email
 * on the Auth record itself requires Cloud Functions or the user to do it themselves.
 * For an admin panel this is acceptable — the profile displayed in the app comes
 * from Firestore, not directly from the Auth record.
 *
 * @param {object} data
 * @param {string}  data.uid
 * @param {string}  [data.displayName]
 * @param {string}  [data.email]
 * @param {string}  [data.role]
 * @param {string}  [data.status]
 * @param {string}  [data.phone]
 */
export async function updateUser({ uid, displayName, email, role, status, phone }) {
  if (!uid) throw new Error('uid is required.');

  const update = { updatedAt: serverTimestamp() };
  if (displayName !== undefined) update.name   = displayName;
  if (email       !== undefined) update.email  = email;
  if (role        !== undefined) update.role   = role;
  if (phone       !== undefined) update.phone  = phone;

  if (status !== undefined) {
    update.status = status;
    // When suspending: record the exact timestamp so the mobile app can
    // enforce the 30-day auto-deactivation rule (suspended → deactivated).
    if (status === 'suspended') {
      update.suspendedAt = serverTimestamp();
    }
    // When un-suspending (back to active/inactive): clear the suspendedAt field
    if (status === 'active' || status === 'inactive') {
      update.suspendedAt = null;
    }
  }

  await updateDoc(doc(db, 'users', uid), update);
}

// ── SOFT-DELETE (DEACTIVATE) USER ─────────────────────────────────────────────
/**
 * Soft-deletes a user by marking their Firestore status as 'deactivated'.
 * The mobile app should check this status on login and deny access.
 * The Firebase Auth account remains (no Admin SDK needed).
 *
 * @param {string} uid
 */
export async function deleteUser(uid) {
  if (!uid) throw new Error('uid is required.');

  await updateDoc(doc(db, 'users', uid), {
    status:      'deactivated',
    deactivatedAt: serverTimestamp(),
  });
}

// ── Error translation ─────────────────────────────────────────────────────────
function translateAuthError(err) {
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email':        'The email address is not valid.',
    'auth/weak-password':        'Password must be at least 8 characters.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  };
  return new Error(map[err.code] || err.message);
}
