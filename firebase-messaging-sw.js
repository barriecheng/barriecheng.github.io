// firebase-messaging-sw.js
// 必須放在網站根目錄（或至少能涵蓋你要的 scope），且用 importScripts 載入 compat 版 SDK

importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

// 1. 初始化 Firebase（設定要和 index.html 完全一致）
firebase.initializeApp({
  apiKey: "AIzaSyA9lJFHBl0RQ6joVHvGX4kOkTsgyWZtpYQ",
  authDomain: "web-notification-459705.firebaseapp.com",
  projectId: "web-notification-459705",
  storageBucket: "web-notification-459705.firebasestorage.app",
  messagingSenderId: "314033823953",
  appId: "1:314033823953:web:c6a222651ab47ea48465f0",
  measurementId: "G-G4XLB03BNN"
});

// 2. 取得 messaging 實例
const messaging = firebase.messaging();

// 3. 處理背景訊息
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 收到背景訊息 payload:', payload);

  const notificationTitle = payload.notification?.title
    || payload.data?.title
    || '新通知';

  const notificationOptions = {
    body: payload.notification?.body
      || payload.data?.body
      || payload.data?.message
      || '',
    icon: payload.notification?.icon || '/icon.png', // 可換成你自己的圖示路徑
    data: payload.data || {} // 保留 data，供 notificationclick 使用
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 4. （可選）點擊通知時的行為
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickUrl = event.notification.data?.click_action || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 如果已經有分頁開著，直接聚焦它
      for (const client of clientList) {
        if (client.url === clickUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // 否則開新分頁
      if (clients.openWindow) {
        return clients.openWindow(clickUrl);
      }
    })
  );
});
