// Firebase messaging service worker for web FCM notifications
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration
firebase.initializeApp({
  apiKey: "AIzaSyDfLKNR7-3rRTHEpSc4Ppk8xfISSIYjnaw",
  authDomain: "soulo-ec325.firebaseapp.com",
  projectId: "soulo-ec325",
  storageBucket: "soulo-ec325.firebasestorage.app",
  messagingSenderId: "183251782093",
  appId: "1:183251782093:web:e92b7ec31d0c651db3dc84",
  measurementId: "G-PLRDN9V6GK"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'Soulo';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'soulo-notification',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click received.');

  event.notification.close();

  // Open the app or focus existing window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      const actionUrl = event.notification.data?.actionUrl || '/app/journal';
      
      // Check if the app is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (actionUrl && client.navigate) {
            client.navigate(actionUrl);
          }
          return;
        }
      }
      
      // If not open, open new window
      if (clients.openWindow) {
        return clients.openWindow(actionUrl);
      }
    })
  );
});