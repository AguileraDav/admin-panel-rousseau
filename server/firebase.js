const admin = require('firebase-admin');
const path = require('path');

let initialized = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    console.log('Inicializado firebase-admin usando FIREBASE_SERVICE_ACCOUNT');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    initialized = true;
    console.log('Inicializado firebase-admin usando GOOGLE_APPLICATION_CREDENTIALS');
  } else {
    const saPath = path.join(__dirname, 'serviceAccountKey.json');
    try {
      const serviceAccount = require(saPath);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      initialized = true;
      console.log('Inicializado firebase-admin usando server/serviceAccountKey.json');
    } catch (err) {
      console.warn('No se encontró serviceAccountKey.json y GOOGLE_APPLICATION_CREDENTIALS no está definida. firebase-admin será inicializado con ADC si está disponible.');
      try {
        admin.initializeApp();
        initialized = true;
      } catch (e) {
        console.error('No se pudo inicializar firebase-admin:', e.message);
      }
    }
  }
} catch (err) {
  console.error('Error inicializando firebase-admin:', err);
}

const db = initialized ? admin.firestore() : null;

module.exports = { admin, db };
