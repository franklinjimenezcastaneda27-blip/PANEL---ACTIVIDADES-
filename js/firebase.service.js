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

  // NUEVO: Obtener el perfil y rol del usuario logueado, y la lista de todos los usuarios
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

  // NUEVO: Escuchar Auditoría (Solo Admin)
  listenAudit: (callback) => {
    const q = query(collection(db, "auditoria"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  },

  // NUEVO: Guardar en Auditoría (Oculto al usuario)
  saveAuditLog: async (accion, detalle) => {
    const userEmail = auth.currentUser ? auth.currentUser.email : "Desconocido";
    await addDoc(collection(db, "auditoria"), {
      accion,
      detalle,
      usuario: userEmail,
      timestamp: new Date().toISOString()
    });
  },

  // NUEVO: Crear/Modificar Usuario
  saveUser: async (data, id = null) => {
    if (id) return updateDoc(doc(db, "usuarios", id), data);
    return addDoc(collection(db, "usuarios"), { ...data, activo: true });
  },

  // --- LECTURAS NORMALES ---
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

  // --- GUARDADO NORMAL ---
  saveEvent: async (data, id = null) => {
    if (id) return updateDoc(doc(db, "eventos", id), data);
    return addDoc(collection(db, "eventos"), data);
  },

  toggleEventStatus: (id, currentStatus) => updateDoc(doc(db, "eventos", id), { completed: !currentStatus }),

  saveAbsence: async (data) => addDoc(collection(db, "asistencias"), data),


  // --- MODIFICADO: ELIMINACIÓN CON AUDITORÍA ---
  deleteEvent: async (id, title) => {
    await FirebaseService.saveAuditLog("ELIMINAR_EVENTO", `Se eliminó la actividad: ${title}`);
    return deleteDoc(doc(db, "eventos", id));
  },
  
  deleteAbsence: async (id, responsible) => {
    await FirebaseService.saveAuditLog("ELIMINAR_ASISTENCIA", `Se eliminó el registro de inasistencia de: ${responsible}`);
    return deleteDoc(doc(db, "asistencias", id));
  }
};
