import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
const firebaseConfig = {
    apiKey: "AIzaSyCMnCwcFbTGpSzt5QcIC0_IOcdX3dtrhSQ",
    authDomain: "plantmonitor-52b21.firebaseapp.com",
    databaseURL: "https://plantmonitor-52b21-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "plantmonitor-52b21",
    storageBucket: "plantmonitor-52b21.appspot.com",
    messagingSenderId: "426680439158",
    appId: "1:426680439158:web:9abf4f4d72de0cc95b6a57",
    measurementId: "G-43BPM23EXN"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);


export { db, auth, storage};
