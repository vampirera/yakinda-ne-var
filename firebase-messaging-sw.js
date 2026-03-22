importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA9-mMM4Cb9G2zNJh7xhG2HFjEAOOf1E4Q",
  authDomain: "yakinda-ne-var-7c5db.firebaseapp.com",
  projectId: "yakinda-ne-var-7c5db",
  storageBucket: "yakinda-ne-var-7c5db.firebasestorage.app",
  messagingSenderId: "738430294415",
  appId: "1:738430294415:web:3fdf6bfb279210afd653fa"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/yakinda-ne-var/icon-192.png'
  });
});
