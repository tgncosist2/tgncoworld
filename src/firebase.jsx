// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCt4WjnNEV-F6qut3jihFH2Mz3u6yIjkWc",
  authDomain: "tgnco-world.firebaseapp.com",
  projectId: "tgnco-world",
  storageBucket: "tgnco-world.firebasestorage.app",
  messagingSenderId: "808223919773",
  appId: "1:808223919773:web:36686a13d71f37b2220e74",
  measurementId: "G-66NW438NM8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
 
export { auth };
export { db };