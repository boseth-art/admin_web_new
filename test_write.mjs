import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, collection, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAxl4imxZQB7bbt4z_cyAubiwGm7_CI5UE",
  authDomain: "smart-financial-management.firebaseapp.com",
  projectId: "smart-financial-management"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testWrite() {
  try {
    await signInWithEmailAndPassword(auth, 'admin@finguard.com', 'Admin@123');
    const targetUid = "LuafC6VsRnh6l5AyaFyvcucSzBq2"; // oldkeg@gmail.com
    
    console.log("Writing test notification...");
    const newNotifRef = doc(collection(db, "users", targetUid, "notifications"));
    await setDoc(newNotifRef, {
      id:                 newNotifRef.id,
      title:              "Test from Script",
      message:            "Test Message",
      type:               "system",
      isRead:             false,
      read:               false,
      studentId:          targetUid,
      severity:           "info",
      sourceModule:       "Support",
      relatedEntityId:    "test",
      createdAt:          Date.now(),
    });
    console.log("Write succeeded! ID:", newNotifRef.id);
  } catch (error) {
    console.error("Write failed:", error);
  }
}

testWrite().finally(() => process.exit(0));
