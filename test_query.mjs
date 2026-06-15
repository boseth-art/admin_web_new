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

async function testQuery() {
  try {
    console.log("Signing in as admin...");
    await signInWithEmailAndPassword(auth, 'admin@finguard.com', 'Admin@123');
    console.log("Signed in successfully. UID:", auth.currentUser.uid);

    console.log("\nQuerying users collection...");
    const snapshot = await getDocs(collection(db, 'users'));
    console.log(`Found ${snapshot.docs.length} documents.`);
    
    snapshot.forEach(doc => {
      console.log(`- ${doc.id} : ${doc.data().email} (role: ${doc.data().role})`);
    });

    console.log("\nDone.");
  } catch (error) {
    console.error("Error:", error);
  }
}

testQuery().finally(() => process.exit(0));
