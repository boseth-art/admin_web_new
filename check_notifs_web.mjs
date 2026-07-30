import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collectionGroup, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAxl4imxZQB7bbt4z_cyAubiwGm7_CI5UE",
  authDomain: "smart-financial-management.firebaseapp.com",
  projectId: "smart-financial-management"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testQuery() {
  try {
    await signInWithEmailAndPassword(auth, 'admin@finguard.com', 'Admin@123');

    console.log("Searching collectionGroup('notifications')...");
    const allNotifs = await getDocs(collectionGroup(db, 'notifications'));
    allNotifs.forEach(doc => {
      console.log(`Path: ${doc.ref.path} =>`, doc.data());
    });

  } catch (error) {
    console.error("Error:", error);
  }
}

testQuery().finally(() => process.exit(0));
