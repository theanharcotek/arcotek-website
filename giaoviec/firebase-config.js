// ==========================================================
//  CẤU HÌNH FIREBASE – dán thông tin project của bạn vào đây
//  (Firebase Console → Project settings → Your apps → Web app → Config)
// ==========================================================
export const firebaseConfig = {
  apiKey: "AIzaSyAzQX4NPrBqq-qMwZrL20UvslSvEFU_nsg",
  authDomain: "arcotek-giaoviec.firebaseapp.com",
  projectId: "arcotek-giaoviec",
  storageBucket: "arcotek-giaoviec.firebasestorage.app",
  messagingSenderId: "933020259164",
  appId: "1:933020259164:web:20b54d3e469a5f274a2799",
};

// Khi đăng nhập chỉ gõ tên (không có @), hệ thống tự thêm đuôi này.
// VD: gõ "linh" → đăng nhập bằng linh@arcotek.vn
export const LOGIN_DOMAIN = "arcotek.vn";
