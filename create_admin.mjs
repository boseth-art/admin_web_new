import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAxl4imxZQB7bbt4z_cyAubiwGm7_CI5UE",
  authDomain: "smart-financial-management.firebaseapp.com",
  projectId: "smart-financial-management",
  storageBucket: "smart-financial-management.firebasestorage.app",
  messagingSenderId: "748858256335",
  appId: "1:748858256335:web:91c7aff8b0524b7c3a00ba",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Take inputs from command-line arguments or use standard defaults
const email = process.argv[2] || "admin@finguard.com";
const password = process.argv[3] || "Admin@123";
const name = process.argv[4] || "Super Admin";

console.log(`Creating Admin Account...`);
console.log(`Email: ${email}`);
console.log(`Name:  ${name}`);

try {
  // 1. Create the user inside Firebase Authentication
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  console.log(`✓ Firebase Authentication user created successfully with UID: ${user.uid}`);

  // 2. Set their Firestore document under the 'users' collection with 'admin' role
  await setDoc(doc(db, "users", user.uid), {
    name: name,
    email: email,
    role: "admin",
    joined: new Date().toISOString().split('T')[0],
    status: "active",
    plan: "Enterprise",
    balance: 50000,
    transactions: 0
  });
  console.log(`✓ Firestore user document created successfully with role: 'admin'`);
  console.log(`\n🎉 Success! You can now log in with:`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
} catch (error) {
  console.error(`\n❌ Failed to create admin account.`);
  console.error(`Error Code:`, error.code);
  console.error(`Error Message:`, error.message);
  if (error.code === 'auth/email-already-in-use') {
    console.log(`\n💡 Tip: This email already exists in Firebase Auth. If you want to make them an admin in Firestore, let me know!`);
  }
}
process.exit(0);
