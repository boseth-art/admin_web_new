const functions = require('firebase-functions');        // V1 — works on free Spark plan
const admin     = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// VALID ROLES  (admin is excluded from the web UI create/edit form,
//              but is still a valid claim for the already-existing admin)
// ─────────────────────────────────────────────────────────────────────────────
const VALID_ROLES = ['student', 'business_owner', 'company_owner', 'multi_account'];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Verify the caller holds the 'admin' JWT Custom Claim.
// V1 onCall passes (data, context); context.auth contains the caller's token.
// ─────────────────────────────────────────────────────────────────────────────
const verifyAdmin = (context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to perform this action.');
  }
  if (context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Access denied. Admin privileges required.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 1: New User Registered
// Fires every time someone creates a Firebase Auth account (mobile app).
// ─────────────────────────────────────────────────────────────────────────────
exports.onNewUserRegistered = functions.auth.user().onCreate(async (user) => {
  try {
    const { uid, email, displayName, photoURL, metadata } = user;

    await db.collection('users').doc(uid).set(
      {
        uid,
        email:        email || '',
        name:         displayName || email?.split('@')[0] || 'New User',
        photoURL:     photoURL || '',
        plan:         'Free',
        status:       'active',
        role:         'student',        // default for self-registered users
        balance:      0,
        transactions: 0,
        phone:        '',
        joined:       metadata?.creationTime || new Date().toISOString().split('T')[0],
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await db.collection('notifications').add({
      title:     'New user registered',
      body:      `${displayName || email || 'A new user'} just created an account.`,
      type:      'user',
      read:      false,
      uid,
      email:     email || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[FinGuard] New user registered: ${email}`);
  } catch (err) {
    console.error('[FinGuard] onNewUserRegistered error:', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 2: New Transaction Created
// Fires when a document is added to the `transactions` collection.
// ─────────────────────────────────────────────────────────────────────────────
exports.onNewTransaction = functions.firestore
  .document('transactions/{txnId}')
  .onCreate(async (snap, context) => {
    try {
      const data = snap.data();
      if (!data) return;

      const amount    = typeof data.amount === 'number' ? data.amount : Number(data.amount || 0);
      const absAmount = Math.abs(amount);
      const isLarge   = absAmount >= 5000;
      const userName  = data.user || data.email || 'A user';
      const currency  = absAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

      await db.collection('notifications').add({
        title:     isLarge ? '⚠️ Large transaction flagged' : 'New transaction recorded',
        body:      isLarge
          ? `${userName} made a ${currency} transaction — please review.`
          : `${userName} recorded a ${currency} transaction (${data.category || 'Uncategorized'}).`,
        type:      isLarge ? 'alert' : 'system',
        read:      false,
        txnId:     context.params.txnId,
        amount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[FinGuard] Transaction: ${currency} by ${userName}`);
    } catch (err) {
      console.error('[FinGuard] onNewTransaction error:', err);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 3: User Deleted
// Fires when a Firebase Auth account is deleted.
// ─────────────────────────────────────────────────────────────────────────────
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  try {
    const { uid, email, displayName } = user;

    await db.collection('users').doc(uid).set(
      { status: 'deleted', deletedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    await db.collection('notifications').add({
      title:     'User account deleted',
      body:      `${displayName || email || 'A user'} deleted their account.`,
      type:      'alert',
      read:      false,
      uid,
      email:     email || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[FinGuard] User deleted: ${email}`);
  } catch (err) {
    console.error('[FinGuard] onUserDeleted error:', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 4: Callable — Create manual admin notification
// ─────────────────────────────────────────────────────────────────────────────
exports.createAdminNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');

  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can create notifications.');
  }

  const { title, body, type = 'system' } = data;
  if (!title || !body) throw new functions.https.HttpsError('invalid-argument', 'title and body are required.');

  await db.collection('notifications').add({
    title,
    body,
    type,
    read:      false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CRUD 1: Create User
// Only admins can call this. Admins CANNOT create another admin account.
// ─────────────────────────────────────────────────────────────────────────────
exports.adminCreateUser = functions.https.onCall(async (data, context) => {
  verifyAdmin(context);

  const { email, password, displayName, role = 'student', phone = '' } = data;

  if (!email || !password || !displayName) {
    throw new functions.https.HttpsError('invalid-argument', 'email, password, and displayName are required.');
  }
  // Admins cannot create other admins from the web panel
  if (role === 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Cannot create admin accounts from the web panel.');
  }
  if (!VALID_ROLES.includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }
  if (password.length < 8) {
    throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 8 characters.');
  }

  try {
    // 1. Create Auth account
    const newUser = await admin.auth().createUser({ email, password, displayName });

    // 2. Set Custom Claim — the JWT security gate
    await admin.auth().setCustomUserClaims(newUser.uid, { role });

    // 3. Write Firestore profile
    await db.collection('users').doc(newUser.uid).set({
      uid:          newUser.uid,
      email,
      name:         displayName,
      phone:        phone || '',
      role,
      plan:         'Free',
      status:       'active',
      balance:      0,
      transactions: 0,
      joined:       new Date().toISOString().split('T')[0],
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      createdBy:    context.auth.uid,
    });

    // 4. Admin notification
    await db.collection('notifications').add({
      title:     'Admin created new user',
      body:      `Admin created account for ${displayName} (${email}) with role '${role}'.`,
      type:      'user',
      read:      false,
      uid:       newUser.uid,
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[FinGuard] adminCreateUser: ${email} as ${role}`);
    return { success: true, uid: newUser.uid };

  } catch (error) {
    console.error('[FinGuard] adminCreateUser error:', error);
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'An account with this email already exists.');
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CRUD 2: Update User
// Admins cannot change a user's role TO admin.
// ─────────────────────────────────────────────────────────────────────────────
exports.adminUpdateUser = functions.https.onCall(async (data, context) => {
  verifyAdmin(context);

  const { uid, displayName, email, role, status, phone } = data;

  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }
  // Block promoting anyone to admin via the web panel
  if (role === 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Cannot assign admin role from the web panel.');
  }
  if (role && !VALID_ROLES.includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }
  const VALID_STATUSES = ['active', 'inactive', 'suspended'];
  if (status && !VALID_STATUSES.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  try {
    const authUpdate = {};
    if (displayName !== undefined) authUpdate.displayName = displayName;
    if (email !== undefined)       authUpdate.email       = email;
    if (Object.keys(authUpdate).length > 0) {
      await admin.auth().updateUser(uid, authUpdate);
    }

    if (role) {
      await admin.auth().setCustomUserClaims(uid, { role });
    }

    const firestoreUpdate = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (displayName !== undefined) firestoreUpdate.name   = displayName;
    if (email !== undefined)       firestoreUpdate.email  = email;
    if (role !== undefined)        firestoreUpdate.role   = role;
    if (status !== undefined)      firestoreUpdate.status = status;
    if (phone !== undefined)       firestoreUpdate.phone  = phone;

    await db.collection('users').doc(uid).update(firestoreUpdate);

    console.log(`[FinGuard] adminUpdateUser: updated ${uid}`);
    return { success: true };

  } catch (error) {
    console.error('[FinGuard] adminUpdateUser error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', 'No user found with that UID.');
    }
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'This email is already used by another account.');
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CRUD 3: Delete User
// Admins cannot delete themselves or other admins.
// ─────────────────────────────────────────────────────────────────────────────
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  verifyAdmin(context);

  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'You cannot delete your own admin account.');
  }

  try {
    // Block deleting another admin
    const targetUser = await admin.auth().getUser(uid);
    if (targetUser.customClaims && targetUser.customClaims.role === 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin accounts cannot be deleted from the web panel.');
    }

    await admin.auth().deleteUser(uid);
    await db.collection('users').doc(uid).delete();

    console.log(`[FinGuard] adminDeleteUser: deleted ${uid}`);
    return { success: true };

  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[FinGuard] adminDeleteUser error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', 'No user found with that UID.');
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});
