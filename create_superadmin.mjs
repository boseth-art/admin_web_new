/**
 * create_superadmin.mjs
 * ──────────────────────
 * One-time bootstrap script to create the Super Admin account.
 * Uses the Firebase Admin SDK (service account) so it can set Custom Claims.
 *
 * HOW TO RUN:
 *   1. Download your Firebase service account key:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *      Save it as: service-account.json  (in this directory — it's in .gitignore)
 *
 *   2. node create_superadmin.mjs [email] [password] [name]
 *      Default: node create_superadmin.mjs superadmin@finguard.com superadmin@123 "Super Admin"
 *
 * IMPORTANT:
 *  - Never commit service-account.json to Git.
 *  - Change the default password immediately after first login.
 *  - The superadmin role CANNOT be assigned from the web UI — only via this script.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ── Load the service account key ─────────────────────────────────────────────
let serviceAccount;
try {
  serviceAccount = require('./service-account.json');
} catch {
  console.error('\n❌ Could not find service-account.json.');
  console.error('   Download it from: Firebase Console → Project Settings → Service Accounts');
  process.exit(1);
}

const app  = initializeApp({ credential: cert(serviceAccount) });
const db   = getFirestore(app);
const auth = getAuth(app);

// ── CLI args ──────────────────────────────────────────────────────────────────
const email    = process.argv[2] || 'superadmin@finguard.com';
const password = process.argv[3] || 'superadmin@123';
const name     = process.argv[4] || 'Super Admin';

console.log('\n👑 FinGuard — Super Admin Bootstrap');
console.log('────────────────────────────────────');
console.log(`Email:    ${email}`);
console.log(`Name:     ${name}`);
console.log('');

try {
  let uid;

  // 1. Try to create the Auth account; if it already exists, look it up
  try {
    const newUser = await auth.createUser({ email, password, displayName: name });
    uid = newUser.uid;
    console.log(`✓ Firebase Auth account created. UID: ${uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
      console.log(`ℹ  Auth account already exists. UID: ${uid}`);
    } else {
      throw err;
    }
  }

  // 2. Set the 'superadmin' Custom Claim on the JWT — the security gate
  await auth.setCustomUserClaims(uid, { role: 'superadmin' });
  console.log(`✓ Custom Claim set: { role: 'superadmin' }`);

  // 3. Write / merge the Firestore profile
  await db.collection('users').doc(uid).set(
    {
      uid,
      email,
      name,
      role:         'superadmin',
      plan:         'Enterprise',
      status:       'active',
      balance:      0,
      transactions: 0,
      phone:        '',
      joined:       new Date().toISOString().split('T')[0],
      createdAt:    FieldValue.serverTimestamp(),
      isSuperAdmin: true,
    },
    { merge: true }
  );
  console.log(`✓ Firestore document written to /users/${uid}`);

  // 4. Seed the featureFlags collection with defaults (if not already seeded)
  const flagsRef = db.collection('featureFlags').doc('global');
  const flagsSnap = await flagsRef.get();
  if (!flagsSnap.exists) {
    await flagsRef.set({
      maintenanceMode:  false,
      rateLimiting:     true,
      auditLogging:     true,
      betaFeatures:     false,
      autoBackup:       true,
      updatedAt:        FieldValue.serverTimestamp(),
      updatedBy:        uid,
    });
    console.log(`✓ Feature flags collection seeded at /featureFlags/global`);
  } else {
    console.log(`ℹ  Feature flags already exist — skipping seed.`);
  }

  console.log('\n🎉 Super Admin account is ready!');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log('\n   ⚠  IMPORTANT: Change this password immediately after first login!');
  console.log('   ⚠  Delete service-account.json now that bootstrap is done.\n');

} catch (err) {
  console.error('\n❌ Bootstrap failed.');
  console.error(`   Code:    ${err.code}`);
  console.error(`   Message: ${err.message}`);
}

process.exit(0);
