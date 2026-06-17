import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAxl4imxZQB7bbt4z_cyAubiwGm7_CI5UE",
  authDomain: "smart-financial-management.firebaseapp.com",
  projectId: "smart-financial-management"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testSubcollections() {
  try {
    await signInWithEmailAndPassword(auth, 'admin@finguard.com', 'Admin@123');

    const usersSnap = await getDocs(collection(db, 'users'));
    for (const userDoc of usersSnap.docs) {
      try {
        const txnsSnap = await getDocs(collection(db, 'users', userDoc.id, 'transactions'));
        if (txnsSnap.docs.length > 0) {
           console.log(`Found ${txnsSnap.docs.length} txns for user ${userDoc.id}`);
           console.log(txnsSnap.docs[0].data());
        }
      } catch (e) {
        // ignore permission errors
      }
      try {
        const trnSnap = await getDocs(collection(db, 'users', userDoc.id, 'transaction'));
        if (trnSnap.docs.length > 0) {
           console.log(`Found ${trnSnap.docs.length} transaction for user ${userDoc.id}`);
        }
      } catch (e) {
      }
    }
    
    console.log("\nDone.");
  } catch (error) {
    console.error("Error:", error);
  }
}

testSubcollections().finally(() => process.exit(0));
