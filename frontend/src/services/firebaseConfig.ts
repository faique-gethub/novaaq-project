import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBXKecCoQL8cdzOBY0-5SEfokDDnzxwnjw",
  authDomain: "hyperlocalmarketplace-6f8ad.firebaseapp.com",
  projectId: "hyperlocalmarketplace-6f8ad",
  storageBucket: "hyperlocalmarketplace-6f8ad.firebasestorage.app",
  messagingSenderId: "418846553794",
  appId: "1:418846553794:web:2b14fe492461308b7aad5b",
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
