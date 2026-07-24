// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

// 1. 初始化 Firebase（Service Worker 裡必須用 compat 版本，因為不支援 ES module import）
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

// 2. 監聽背景訊息
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 收到背景訊息:', payload);

  let title = payload.notification?.title;
  let body = payload.notification?.body;

  // 如果沒有 notification 欄位，改用 data 欄位（data-only 訊息）
  if (!title && payload.data) {
    title = payload.data.title || '新通知';
    body = payload.data.body || payload.data.message || '';
  }

  const notificationOptions = {
    body: body,
    icon: payload.notification?.image || '/icon.png', // 換成你自己的 icon 路徑
    data: payload.data || {} // 保留 data，讓點擊事件可以取用
  };

  self.registration.showNotification(title, notificationOptions);
});

// 3. （選用）點擊通知後的行為，例如導向指定網址
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.click_action || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
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
