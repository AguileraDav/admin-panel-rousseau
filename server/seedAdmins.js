// Script de un solo uso: crea/actualiza las cuentas de administrador y profesor
// en la colección "admins" de Firestore. Ejecutar con: node seedAdmins.js
const bcrypt = require('bcryptjs');
const { db } = require('./firebase');

const ADMINS_COLLECTION = 'admins';

const ACCOUNTS = [
  { email: 'admin@rousseau.edu.mx', password: 'Admin2024!', role: 'admin' },
  { email: 'profesor@rousseau.edu.mx', password: 'Profesor2024!', role: 'profesor' }
];

async function seed() {
  if (!db) {
    console.error('No se pudo inicializar Firestore. Revisa las credenciales.');
    process.exit(1);
  }

  for (const account of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    const existing = await db.collection(ADMINS_COLLECTION)
      .where('email', '==', account.email)
      .limit(1)
      .get();

    if (existing.empty) {
      await db.collection(ADMINS_COLLECTION).add({
        email: account.email,
        passwordHash,
        role: account.role
      });
      console.log(`Creada cuenta: ${account.email} (${account.role})`);
    } else {
      await existing.docs[0].ref.update({ passwordHash, role: account.role });
      console.log(`Actualizada cuenta: ${account.email} (${account.role})`);
    }
  }

  console.log('Listo.');
  process.exit(0);
}

seed();
