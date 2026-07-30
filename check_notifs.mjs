import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const uid = "LuafC6VsRnh6l5AyaFyvcucSzBq2"; // From user's previous log

  const notifs = await db.collection(`users/${uid}/notifications`).get();
  console.log(`Found ${notifs.size} notifications for user ${uid}:`);
  notifs.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });
  
  // Also check if there are any users with an email
  const allUsers = await db.collection("users").get();
  console.log(`\nFound ${allUsers.size} total users in DB.`);
  allUsers.forEach(doc => {
    if (doc.id === uid) {
      console.log(`User ${uid} data:`, doc.data());
    }
  });

  // Check root notifications to see if the complaint was replied to
  const rootNotifs = await db.collection("notifications").get();
  console.log(`\nFound ${rootNotifs.size} total root notifications.`);
  rootNotifs.forEach(doc => {
    if (doc.data().type === 'complaint') {
      console.log(doc.id, "=>", doc.data());
    }
  });
}

check().catch(console.error);
