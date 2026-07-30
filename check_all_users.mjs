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

async function run() {
  await signInWithEmailAndPassword(auth, 'admin@finguard.com', 'Admin@123');
  const snap = await getDocs(collection(db, 'users'));
  
  snap.forEach(d => {
    const email = d.data().email || "";
    console.log(`ID=${d.id}, email=${email}`);
  });
}

run().finally(() => process.exit(0));
