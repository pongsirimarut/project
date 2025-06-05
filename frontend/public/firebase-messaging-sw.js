importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "BEa2v0RsBcyhm2gFRJiYjLlOrLrHQ3VrAsVTk2W2E9DTuW4uZYIqiC_NiHk5QJ-jBEj3mNa21ztkI09URFkxakw",
  authDomain: "solar-project-49005.firebaseapp.com",
  projectId: "solar-project-49005",
  storageBucket: "solar-project-49005.appspot.com",
  messagingSenderId: "705439795193",
  appId: "1:705439795193:web:abcdef1234567890", // แทนด้วย appId จริง
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  console.log('Received background message:', payload);
  const notificationTitle = payload.notification?.title || 'แจ้งเตือนพลังงานแสงอาทิตย์';
  const notificationOptions = {
    body: payload.notification?.body || 'มีเหตุการณ์ใหม่',
    icon: '/favicon.ico',
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});