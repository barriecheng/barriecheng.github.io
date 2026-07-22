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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 背景收到推播:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico' // 可選：你的 App 圖示
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
