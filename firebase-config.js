import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5o_VJNrgS5RFY2s0FgmdxrzfNPYghpHk",
  authDomain: "estudos-pessoais-filipe.firebaseapp.com",
  projectId: "estudos-pessoais-filipe",
  storageBucket: "estudos-pessoais-filipe.firebasestorage.app",
  messagingSenderId: "440369966959",
  appId: "1:440369966959:web:085821b7d9752a6fcc829a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
