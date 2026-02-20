import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB1ZTwRXaR89ItkFTKGaqWo3cyfBAv5Cc4",
  authDomain: "calendario-de-actividade-3b553.firebaseapp.com",
  projectId: "calendario-de-actividade-3b553",
  storageBucket: "calendario-de-actividade-3b553.firebasestorage.app",
  messagingSenderId: "330806785515",
  appId: "1:330806785515:web:3448d1f0ffc83422c795ae"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export const auth = getAuth(app);

export const FirebaseService = {
  login: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
  
  onAuthChange: (callback) => onAuthStateChanged(auth, callback),

  listenEvents: (callback) => {
    const q = query(collection(db, "eventos"), orderBy("time"));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  listenAbsences: (callback) => {
    return onSnapshot(collection(db, "asistencias"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  saveEvent: async (data, id = null) => {
    if (id) return updateDoc(doc(db, "eventos", id), data);
    return addDoc(collection(db, "eventos"), data);
  },

  deleteEvent: (id) => deleteDoc(doc(db, "eventos", id)),
  
  toggleEventStatus: (id, currentStatus) => updateDoc(doc(db, "eventos", id), { completed: !currentStatus }),

  saveAbsence: async (data) => addDoc(collection(db, "asistencias"), data),

  deleteAbsence: (id) => deleteDoc(doc(db, "asistencias", id))
};
