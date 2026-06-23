// Firebase 配置和初始化
const firebaseConfig = {
  apiKey: "AIzaSyBOCdtQzdU0o4zj_wzAJjGnItgJCJsOuS0",
  authDomain: "thaiaphabet.firebaseapp.com",
  projectId: "thaiaphabet",
  storageBucket: "thaiaphabet.firebasestorage.app",
  messagingSenderId: "171278666463",
  appId: "1:171278666463:web:87efd9c940d2e609faf76a",
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
