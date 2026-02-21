import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// ¡MAGIA OFFLINE!: Esto habilita la persistencia de datos sin internet
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn("La persistencia offline solo funciona en una pestaña a la vez.");
  } else if (err.code == 'unimplemented') {
    console.warn("Este navegador no soporta el modo offline.");
  }
});

export const FirebaseService = {
  login: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
  onAuthChange: (callback) => onAuthStateChanged(auth, callback),

  getUserProfile: async (email) => {
    const q = query(collection(db, "usuarios"), orderBy("nombre"));
    return new Promise((resolve) => {
      onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const current = users.find(u => u.email === email);
        resolve({ users, current });
      });
    });
  },

  listenAudit: (callback) => {
    const q = query(collection(db, "auditoria"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  },

  saveAuditLog: async (accion, detalle) => {
    const userEmail = auth.currentUser ? auth.currentUser.email : "Desconocido";
    await addDoc(collection(db, "auditoria"), { accion, detalle, usuario: userEmail, timestamp: new Date().toISOString() });
  },

  saveUser: async (data, id = null) => {
    if (id) return updateDoc(doc(db, "usuarios", id), data);
    return addDoc(collection(db, "usuarios"), { ...data, activo: true });
  },

  listenEvents: (callback) => {
    const q = query(collection(db, "eventos"), orderBy("time"));
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  },

  listenAbsences: (callback) => {
    return onSnapshot(collection(db, "asistencias"), (snapshot) => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  },

  saveEvent: async (data, id = null) => {
    if (id) return updateDoc(doc(db, "eventos", id), data);
    return addDoc(collection(db, "eventos"), data);
  },

  saveAbsence: async (data) => addDoc(collection(db, "asistencias"), data),

  deleteEvent: async (id, title) => {
    await FirebaseService.saveAuditLog("ELIMINAR_EVENTO", `Se eliminó la actividad: ${title}`);
    return deleteDoc(doc(db, "eventos", id));
  },
  
  deleteAbsence: async (id, responsible) => {
    await FirebaseService.saveAuditLog("ELIMINAR_ASISTENCIA", `Se eliminó el registro de inasistencia de: ${responsible}`);
    return deleteDoc(doc(db, "asistencias", id));
  },

  updateEventFieldManagement: async (id, updateData) => {
    return updateDoc(doc(db, "eventos", id), updateData);
  }
};
