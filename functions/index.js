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
      title:         'New user registered',
      body:          `${displayName || email || 'A new user'} just created an account.`,
      type:          'user',
      read:          false,
      uid,
      email:         email || '',
      isUserTargeted: true,
      createdAt:     admin.firestore.FieldValue.serverTimestamp(),
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
      title:         'User account deleted',
      body:          `${displayName || email || 'A user'} deleted their account.`,
      type:          'alert',
      read:          false,
      uid,
      email:         email || '',
      isUserTargeted: true,
      createdAt:     admin.firestore.FieldValue.serverTimestamp(),
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

  const { title, body, type = 'system', uid, email } = data;
  if (!title || !body) throw new functions.https.HttpsError('invalid-argument', 'title and body are required.');
  if (title.length > 200) throw new functions.https.HttpsError('invalid-argument', 'Title must be 200 characters or fewer.');
  if (body.length > 2000) throw new functions.https.HttpsError('invalid-argument', 'Body must be 2000 characters or fewer.');

  const notification = {
    title,
    body,
    type,
    read:      false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (email) {
    notification.email = email;
  }

  // If targeting a specific user, write to their subcollection in the format the mobile app expects
  if (uid) {
    const newNotifRef = db.collection('users').doc(uid).collection('notifications').doc();
    await newNotifRef.set({
      id:                 newNotifRef.id,
      title:              title,
      message:            body,
      type:               type,
      isRead:             false,
      read:               false,
      studentId:          uid,
      severity:           'info',
      sourceModule:       'System',
      createdAt:          Date.now(),
    });
    // Also write to the admin's view so they know it was sent
    notification.isUserTargeted = true;
    notification.uid = uid;
    await db.collection('notifications').add(notification);
  } else {
    await db.collection('notifications').add(notification);
  }

  return { success: true };
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENDPOINT: Submit Complaint
// Allows anyone (guests) to submit a complaint via the website form.
// ─────────────────────────────────────────────────────────────────────────────
exports.submitComplaint = functions.https.onCall(async (data, context) => {
  const { email, message } = data;
  if (!email || !message) {
    throw new functions.https.HttpsError('invalid-argument', 'email and message are required.');
  }
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email format.');
  }
  
  if (message.length > 2000) {
    throw new functions.https.HttpsError('invalid-argument', 'Message is too long (max 2000 characters).');
  }

  try {
    await db.collection('notifications').add({
      title:     'New Complaint from User',
      body:      message,
      type:      'complaint',
      read:      false,
      email:     email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[FinGuard] New complaint received from: ${email}`);
    return { success: true };
  } catch (err) {
    console.error('[FinGuard] submitComplaint error:', err);
    throw new functions.https.HttpsError('internal', 'Failed to submit complaint.');
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Resolve a user UID from an email address.
// Queries the `users` Firestore collection for a document with matching email.
// Returns the uid string, or null if not found (e.g. guest complaint).
// ─────────────────────────────────────────────────────────────────────────────
const resolveUidByEmail = async (email) => {
  if (!email) return null;
  const snap = await db.collection('users')
    .where('email', '==', email.toLowerCase().trim())
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id; // document ID is the uid
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SUPPORT 1: Send Acknowledgement (1-click auto-reply)
// Admin calls this after seeing a complaint notification.
// Looks up the user UID by email, writes a pre-written reply notification
// targeted at that user, and marks the complaint as "replied".
// ─────────────────────────────────────────────────────────────────────────────
exports.adminSendAcknowledgement = functions.https.onCall(async (data, context) => {
  verifyAdmin(context);

  const { complaintId, email } = data;

  if (!complaintId || !email) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'complaintId and email are required.'
    );
  }

  // 1. Verify the complaint document exists
  const complaintRef = db.collection('notifications').doc(complaintId);
  const complaintSnap = await complaintRef.get();
  if (!complaintSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Complaint not found.');
  }
  const complaintData = complaintSnap.data();

  // 2. Guard: already replied?
  if (complaintData.replied === true) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'This complaint has already been replied to.'
    );
  }

  // 3. Resolve UID from email — queries users collection by email field
  const targetUid = await resolveUidByEmail(email);

  // 4. Write the automated acknowledgement notification targeted at the user
  const replyBody =
    'Thank you for reaching out to us. We have received your message and our team ' +
    'is currently reviewing your concern. We will get back to you as soon as possible. ' +
    '– FinGuard Support Team';

  if (targetUid) {
    const newNotifRef = db.collection('users').doc(targetUid).collection('notifications').doc();
    await newNotifRef.set({
      id:                 newNotifRef.id,
      title:              "✅ Support: We've received your message",
      message:            replyBody,
      type:               'system',
      isRead:             false,
      read:               false,
      studentId:          targetUid,
      severity:           'info',
      sourceModule:       'Support',
      relatedEntityId:    complaintId,
      createdAt:          Date.now(),
    });
  }

  // 5. Mark original complaint as replied
  await complaintRef.update({
    replied:   true,
    repliedAt: admin.firestore.FieldValue.serverTimestamp(),
    repliedBy: context.auth.uid,
  });

  console.log(`[FinGuard] adminSendAcknowledgement: replied to ${complaintId} for ${email}`);
  return { success: true, resolvedUid: targetUid };
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SUPPORT 2: Send Detailed Reply (custom message from admin)
// Admin writes a custom subject + body in the ReplyDialog and sends it.
// Same email→UID lookup strategy as above.
// ─────────────────────────────────────────────────────────────────────────────
exports.adminSendDetailedReply = functions.https.onCall(async (data, context) => {
  verifyAdmin(context);

  const { complaintId, email, subject, message } = data;

  if (!complaintId || !email || !message) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'complaintId, email, and message are required.'
    );
  }
  if (message.length > 2000) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Message is too long (max 2000 characters).'
    );
  }

  // 1. Verify the complaint document exists
  const complaintRef = db.collection('notifications').doc(complaintId);
  const complaintSnap = await complaintRef.get();
  if (!complaintSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Complaint not found.');
  }

  // 2. Resolve UID from email
  const targetUid = await resolveUidByEmail(email);

  // 3. Write the custom reply notification to the user's specific notifications subcollection
  if (targetUid) {
    const newNotifRef = db.collection('users').doc(targetUid).collection('notifications').doc();
    await newNotifRef.set({
      id:                 newNotifRef.id,
      title:              subject || 'Message from FinGuard Support',
      message:            message,
      type:               'system',
      isRead:             false,
      read:               false,
      studentId:          targetUid,
      severity:           'info',
      sourceModule:       'Support',
      relatedEntityId:    complaintId,
      createdAt:          Date.now(),
    });
  }

  // 4. Mark original complaint as replied (idempotent — already replied is fine here)
  await complaintRef.update({
    replied:   true,
    repliedAt: admin.firestore.FieldValue.serverTimestamp(),
    repliedBy: context.auth.uid,
  });

  console.log(`[FinGuard] adminSendDetailedReply: replied to ${complaintId} for ${email}`);
  return { success: true, resolvedUid: targetUid };
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN HELPER: Verify the caller holds the 'superadmin' JWT claim.
// ─────────────────────────────────────────────────────────────────────────────
const verifySuperAdmin = async (context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }
  // Check JWT claim first (fast path)
  if (context.auth.token.role === 'superadmin') return;

  // Fallback: check Firestore document (handles token refresh delays)
  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Super Admin privileges required.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN 1: Create Admin Account
// Only super admins can create new admin accounts.
// ─────────────────────────────────────────────────────────────────────────────
exports.superAdminCreateAdmin = functions.https.onCall(async (data, context) => {
  await verifySuperAdmin(context);

  const { email, password, displayName, phone = '' } = data;

  if (!email || !password || !displayName) {
    throw new functions.https.HttpsError('invalid-argument', 'email, password, and displayName are required.');
  }
  if (password.length < 8) {
    throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 8 characters.');
  }

  try {
    // 1. Create Firebase Auth user
    const newUser = await admin.auth().createUser({ email, password, displayName });

    // 2. Set custom claim: role = 'admin'
    await admin.auth().setCustomUserClaims(newUser.uid, { role: 'admin' });

    // 3. Write Firestore profile
    await db.collection('users').doc(newUser.uid).set({
      uid:          newUser.uid,
      email,
      name:         displayName,
      fullName:     displayName,
      phone:        phone || '',
      mobile:       phone || '',
      role:         'admin',
      plan:         'Enterprise',
      status:       'active',
      balance:      0,
      transactions: 0,
      joined:       new Date().toISOString().split('T')[0],
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      createdBy:    context.auth.uid,
    });

    // 4. Notify (in notifications collection)
    await db.collection('notifications').add({
      title:     '👑 New admin account created',
      body:      `Super Admin created admin account for ${displayName} (${email}).`,
      type:      'system',
      read:      false,
      uid:       newUser.uid,
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[FinGuard] superAdminCreateAdmin: ${email} as admin by ${context.auth.uid}`);
    return { success: true, uid: newUser.uid };

  } catch (error) {
    console.error('[FinGuard] superAdminCreateAdmin error:', error);
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'An account with this email already exists.');
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN 2: Update Admin Account
// Super admins can update any admin's profile and status.
// ─────────────────────────────────────────────────────────────────────────────
exports.superAdminUpdateAdmin = functions.https.onCall(async (data, context) => {
  await verifySuperAdmin(context);

  const { uid, displayName, email, phone, status } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'uid is required.');

  const VALID_STATUSES = ['active', 'inactive', 'suspended'];
  if (status && !VALID_STATUSES.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  try {
    // Update Firebase Auth record
    const authUpdate = {};
    if (displayName) authUpdate.displayName = displayName;
    if (email)       authUpdate.email       = email;
    if (Object.keys(authUpdate).length > 0) {
      await admin.auth().updateUser(uid, authUpdate);
    }

    // Update Firestore
    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (displayName) { update.name = displayName; update.fullName = displayName; }
    if (email)       update.email  = email;
    if (phone)       { update.phone = phone; update.mobile = phone; }
    if (status)      update.status = status;

    await db.collection('users').doc(uid).update(update);

    console.log(`[FinGuard] superAdminUpdateAdmin: updated ${uid} by ${context.auth.uid}`);
    return { success: true };

  } catch (error) {
    console.error('[FinGuard] superAdminUpdateAdmin error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', 'No user found with that UID.');
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN 3: Revoke Admin Access (soft)
// Strips the 'admin' JWT claim and sets Firestore status to 'revoked'.
// The Auth account and Firestore document are preserved — it's reversible.
// ─────────────────────────────────────────────────────────────────────────────
exports.superAdminRevokeAdmin = functions.https.onCall(async (data, context) => {
  await verifySuperAdmin(context);

  const { uid } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'uid is required.');

  // Block revoking yourself
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'You cannot revoke your own super admin access.');
  }

  try {
    // Strip the role custom claim (set to null — empty claims object)
    await admin.auth().setCustomUserClaims(uid, { role: null });

    // Update Firestore
    await db.collection('users').doc(uid).update({
      role:      'revoked',
      status:    'revoked',
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      revokedBy: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('notifications').add({
      title:     '⛔ Admin access revoked',
      body:      `Admin access has been revoked for user ${uid} by super admin.`,
      type:      'alert',
      read:      false,
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[FinGuard] superAdminRevokeAdmin: revoked ${uid} by ${context.auth.uid}`);
    return { success: true };

  } catch (error) {
    console.error('[FinGuard] superAdminRevokeAdmin error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN 4: Delete Admin Account (hard)
// Permanently deletes the Firebase Auth user and Firestore document.
// Cannot target self or other super admins.
// ─────────────────────────────────────────────────────────────────────────────
exports.superAdminDeleteAdmin = functions.https.onCall(async (data, context) => {
  await verifySuperAdmin(context);

  const { uid } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'You cannot delete your own account.');
  }

  try {
    // Block deleting another super admin
    const targetUser = await admin.auth().getUser(uid);
    if (targetUser.customClaims && targetUser.customClaims.role === 'superadmin') {
      throw new functions.https.HttpsError('permission-denied', 'Super admin accounts cannot be deleted via the web panel.');
    }

    // Hard delete Auth + Firestore
    await admin.auth().deleteUser(uid);
    await db.collection('users').doc(uid).delete();

    await db.collection('notifications').add({
      title:     '🗑️ Admin account deleted',
      body:      `Admin account ${uid} has been permanently deleted by super admin.`,
      type:      'alert',
      read:      false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[FinGuard] superAdminDeleteAdmin: deleted ${uid} by ${context.auth.uid}`);
    return { success: true };

  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[FinGuard] superAdminDeleteAdmin error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', 'No user found with that UID.');
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});
