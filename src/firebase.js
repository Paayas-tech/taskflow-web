import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCOeDqX9KSdpDNi5oCMq33SLCojUxmHTfg",
  authDomain: "taskflow-f86e0.firebaseapp.com",
  projectId: "taskflow-f86e0",
  storageBucket: "taskflow-f86e0.firebasestorage.app",
  messagingSenderId: "403462380015",
  appId: "1:403462380015:web:39208d3a67c1a1a174be1a",
  measurementId: "G-6VK53F8NH3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
export default app;