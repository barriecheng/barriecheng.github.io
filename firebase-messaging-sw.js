// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA9lJFHBl0RQ6joVHvGX4kOkTsgyWZtpYQ",
  authDomain: "web-notification-459705.firebaseapp.com",
  projectId: "web-notification-459705",
  storageBucket: "web-notification-459705.firebasestorage.app",
  messagingSenderId: "314033823953",
  appId: "1:314033823953:web:c6a222651ab47ea48465f0",
  measurementId: "G-G4XLB03BNN"
});

const messaging = firebase.messaging();

// 背景收到訊息的處理
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 背景收到推播:', payload);

  // 1. 安全取得標題與內容（使用選擇性串連 ?. 防爆，並提供預設值）
  const notificationTitle = payload.notification?.title || payload.data?.title || '新通知';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: payload.notification?.icon || '/favicon.ico',
    data: payload.data // 可放置自訂資料（例如點擊後要開啟的網址）
  };

  // 2. 如果推播【只有 data 欄位】時，手動跳出通知
  // (若帶有 notification 欄位，SDK 預設會自動跳通知，無需手動觸發)
  if (!payload.notification) {
    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

// (選用) 監聽使用者點擊通知後的動作
self.addEventListener('notificationclick', (event) => {
  console.log('使用者點擊了通知:', event);
  event.notification.close(); // 關閉通知視窗

  // 點擊後開啟網頁（例如回到首頁或特定 URL）
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 如果已經有開著的標籤頁就直接聚焦，沒有就開啟新標籤頁
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
