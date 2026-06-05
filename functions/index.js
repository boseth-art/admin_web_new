const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { auth }               = require('firebase-functions/v2');
const admin                  = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 1: New User Registered
// Fires automatically every time someone creates a Firebase Auth account.
// Writes a notification to Firestore so the admin sees it instantly.
// ─────────────────────────────────────────────────────────────────────────────
exports.onNewUserRegistered = auth.user().onCreate(async (user) => {
  try {
    const { uid, email, displayName, photoURL, creationTime } = user;

    // 1. Write the user document to the `users` collection (if not already there)
    //    The mobile app may do this too — this is a safety net.
    await db.collection('users').doc(uid).set(
      {
        uid,
        email:     email || '',
        name:      displayName || email?.split('@')[0] || 'New User',
        photoURL:  photoURL || '',
        plan:      'Free',
        status:    'active',
        role:      'user',          // NOT admin — users are never admin by default
        balance:   0,
        transactions: 0,
        joined:    creationTime || new Date().toISOString(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }              // merge so mobile-app data isn't overwritten
    );

    // 2. Write a notification for the admin panel
    await db.collection('notifications').add({
      title:     'New user registered',
      body:      `${displayName || email || 'A new user'} just created an account.`,
      type:      'user',
      read:      false,
      uid:       uid,
      email:     email || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[FinGuard] New user notification created for: ${email}`);
  } catch (err) {
    console.error('[FinGuard] onNewUserRegistered error:', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 2: New Transaction Created
// Fires when a document is added to the `transactions` collection.
// Notifies the admin — with a special alert for large amounts.
// ─────────────────────────────────────────────────────────────────────────────
exports.onNewTransaction = onDocumentCreated('transactions/{txnId}', async (event) => {
  try {
    const data   = event.data?.data();
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
      txnId:     event.params.txnId,
      amount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[FinGuard] Transaction notification: ${currency} by ${userName}`);
  } catch (err) {
    console.error('[FinGuard] onNewTransaction error:', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 3: User Deleted
// Fires when a Firebase Auth account is deleted.
// Notifies the admin and updates the user document status.
// ─────────────────────────────────────────────────────────────────────────────
exports.onUserDeleted = auth.user().onDelete(async (user) => {
  try {
    const { uid, email, displayName } = user;

    // Update user doc status to 'deleted'
    await db.collection('users').doc(uid).set(
      { status: 'deleted', deletedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    // Notify admin
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
// The admin web app can call this to push a custom notification.
// ─────────────────────────────────────────────────────────────────────────────
exports.createAdminNotification = onCall(async (request) => {
  // Only allow calls from authenticated admins
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated.');

  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can create notifications.');
  }

  const { title, body, type = 'system' } = request.data;
  if (!title || !body) throw new HttpsError('invalid-argument', 'title and body are required.');

  await db.collection('notifications').add({
    title,
    body,
    type,
    read:      false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});
