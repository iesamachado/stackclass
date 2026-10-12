import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, query, where, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: REEMPLAZA ESTO CON LA CONFIGURACIÓN DE TU PROYECTO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCU2akWX0Tjq8946bsgqDrynPhGT4s-TXI",
  authDomain: "arenabot-d6f56.firebaseapp.com",
  projectId: "arenabot-d6f56",
  storageBucket: "arenabot-d6f56.firebasestorage.app",
  messagingSenderId: "703333332151",
  appId: "1:703333332151:web:412eb3321ba40feebe8932",
  measurementId: "G-DMH2PKJ9S7"
};

// Inicializar Firebase
let app, auth, db, googleProvider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} catch (e) {
  console.warn("⚠️ Firebase no está configurado correctamente. Añade tus claves a firebase-config.js", e);
}

export { 
  auth, 
  db, 
  googleProvider,
  GoogleAuthProvider,
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  serverTimestamp,
  deleteDoc
};
