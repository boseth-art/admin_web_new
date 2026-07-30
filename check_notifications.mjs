import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function main() {
  // 1. Get all users
  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} users.`);
  
  // 2. For each user, check their notifications subcollection
  let totalNotifs = 0;
  for (const doc of usersSnap.docs) {
    const notifsSnap = await db.collection('users').doc(doc.id).collection('notifications').get();
    if (!notifsSnap.empty) {
      console.log(`User ${doc.id} (${doc.data().email}) has ${notifsSnap.size} notifications:`);
      notifsSnap.forEach(n => {
        console.log(`  - ${n.id}:`, n.data());
      });
      totalNotifs += notifsSnap.size;
    }
  }
  console.log(`Total notifications in user subcollections: ${totalNotifs}`);
  
  // 3. Check root notifications collection
  const rootNotifsSnap = await db.collection('notifications').get();
  console.log(`Total notifications in ROOT collection: ${rootNotifsSnap.size}`);
}

main().catch(console.error);
