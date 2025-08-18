// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push, update, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWyh-_j8tP5r6gmga2kdNORFGgi9tXGbQ",
  authDomain: "acai-da-bella.firebaseapp.com",
  databaseURL: "https://acai-da-bella-default-rtdb.firebaseio.com",
  projectId: "acai-da-bella",
  storageBucket: "acai-da-bella.appspot.com",
  messagingSenderId: "740114535784",
  appId: "1:740114535784:web:d08114d8d344f83c9af2dd"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

export { db, ref, onValue, set, push, update, remove, storage, storageRef, uploadBytes, getDownloadURL };
