// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC9DwFn_xOTxQisvnlguJZQLc9gAakXKOI",
  authDomain: "studyhub-8bb72.firebaseapp.com",
  projectId: "studyhub-8bb72",
  storageBucket: "studyhub-8bb72.firebasestorage.app",
  messagingSenderId: "180765235034",
  appId: "1:180765235034:web:4a826102b5a3bccecd0563"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});