import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);
const auth = getAuth(app);

async function checkDatabase() {
  console.log("--- Auth Users ---");
  const authUsers = await auth.listUsers(100);
  authUsers.users.forEach(u => console.log(u.email, u.uid));

  console.log("\n--- Firestore 'users' collection ---");
  const snapshot = await db.collection('users').get();
  snapshot.forEach(doc => {
    console.log(doc.id, "=>", doc.data().email, doc.data().role);
  });
}

checkDatabase().catch(console.error).finally(() => process.exit(0));
