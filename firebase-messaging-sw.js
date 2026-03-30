self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('data', data);

  self.registration.showNotification(data.notification.title, {
    body: data.notification.body,
    icon: data.notification.image,
    data: data.data
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});