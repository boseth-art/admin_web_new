/**
 * create_admin.mjs
 * ─────────────────
 * One-time bootstrap script to create or promote your first admin account.
 * Uses the Firebase Admin SDK (service account) so it can set Custom Claims.
 *
 * HOW TO RUN:
 *   1. Download your Firebase service account key:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *      Save it as: service-account.json  (in this directory — it's in .gitignore)
 *
 *   2. node create_admin.mjs [email] [password] [name]
 *      Example: node create_admin.mjs admin@finguard.com Admin@1234 "Super Admin"
 *
 * IMPORTANT: Never commit service-account.json to Git.
 */

import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ── Load the service account key ────────────────────────────────────────────
let serviceAccount;
try {
  serviceAccount = require('./service-account.json');
} catch {
  console.error('\n❌ Could not find service-account.json.');
  console.error('   Download it from: Firebase Console → Project Settings → Service Accounts');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

// ── CLI args ─────────────────────────────────────────────────────────────────
const email    = process.argv[2] || 'admin@finguard.com';
const password = process.argv[3] || 'Admin@1234';
const name     = process.argv[4] || 'Super Admin';

console.log('\n🔐 FinGuard — Admin Bootstrap');
console.log('─────────────────────────────────');
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

  // 2. Set the 'admin' Custom Claim on the JWT — this is the security gate
  await auth.setCustomUserClaims(uid, { role: 'admin' });
  console.log(`✓ Custom Claim set: { role: 'admin' }`);

  // 3. Write / merge the Firestore profile
  await db.collection('users').doc(uid).set(
    {
      uid,
      email,
      name,
      role:         'admin',
      plan:         'Enterprise',
      status:       'active',
      balance:      0,
      transactions: 0,
      phone:        '',
      joined:       new Date().toISOString().split('T')[0],
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`✓ Firestore document written to /users/${uid}`);

  console.log('\n🎉 Admin account is ready!');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log('\n   ⚠  Delete service-account.json now that bootstrap is done.\n');

} catch (err) {
  console.error('\n❌ Bootstrap failed.');
  console.error(`   Code:    ${err.code}`);
  console.error(`   Message: ${err.message}`);
}

process.exit(0);
