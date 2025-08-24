self.addEventListener('install', (e)=> self.skipWaiting());
self.addEventListener('activate', (e)=> self.clients.claim());

// Visa pushen
self.addEventListener('push', (event) => {
  const data = event.data?.json?.() || { title: 'Dagens utmaning', body: 'Dags att träna!' }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Dagens utmaning', {
      body: data.body || 'Dags att träna!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.url || '/'
    })
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data || '/'
  event.waitUntil(clients.openWindow(url))
})