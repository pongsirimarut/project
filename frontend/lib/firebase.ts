import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, MessagePayload } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyDdr6O1arbBIGxB8oZGm3LE9JsE9lS5o3k",
  authDomain: "solar-project-49005.firebaseapp.com",
  projectId: "solar-project-49005",
  storageBucket: "solar-project-49005.firebasestorage.app",
  messagingSenderId: "705439795193",
  appId: "1:705439795193:web:5c400439d9207521829f28",
  measurementId: "G-T58NVVRMS5",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Cloud Messaging
let messaging: Messaging;
if (typeof window !== 'undefined') {
  messaging = getMessaging(app);
  console.log('Firebase messaging initialized');
} else {
  console.warn('Firebase messaging not initialized (server-side)');
  messaging = null; // หรือจัดการตามความเหมาะสมสำหรับ server-side
}

// VAPID Key (ใช้ Public Key จาก Firebase Console)
const vapidKey = "BEa2v0RsBcyhm2gFRJiYjLlOrLrHQ3VrAsVTk2W2E9DTuW4uZYIqiC_NiHk5QJ-jBEj3mNa21ztkI09URFkxakw";

export const requestNotificationPermission = async () => {
  if (!messaging) {
    console.warn('Messaging not initialized.');
    return null;
  }

  if (!vapidKey) {
    console.error('Missing VAPID key. Please update vapidKey in firebase.ts');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied.');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    if (!token) {
      console.warn('No FCM token received.');
      return null;
    }

    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting notification token:', error);
    return null;
  }
};

export const onMessageListener = (): Promise<MessagePayload | null> =>
  new Promise(resolve => {
    if (!messaging) {
      console.warn('Notifications disabled.');
      resolve(null);
      return;
    }
    onMessage(messaging, payload => {
      console.log('Foreground message:', payload);
      resolve(payload);
    });
  });