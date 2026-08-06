// Script de un solo uso: crea a la alumna "Sofia Perez" en la colección "grades"
// (usada tanto para calificaciones como para asistencia) y la asocia mediante
// la colección "inscripciones" a TODAS las cuentas registradas en Firebase Auth.
// Ejecutar con: node seedSofiaPerez.js
const { admin, db } = require('./firebase');

const GRADES_COLLECTION = 'grades';
const ENROLLMENTS_COLLECTION = 'inscripciones';

const STUDENT_NAME = 'Sofia Perez';
const STUDENT_CODE = 'ROUSS-2026-002';
const STUDENT_ID = 'sofia-perez'; // usado como id de documento en "grades" y "asistencia"

const BIMESTRES = ['B1', 'B2', 'B3', 'B4', 'B5'];
const DEFAULT_SUBJECTS = [
  'Lenguaje y comunicación',
  'Pensamiento matemático',
  'Desarrollo personal y social',
  'Exploración y conocimiento del medio',
  'Desarrollo físico y salud',
  'Expresión y apreciación artística',
  'Inglés',
  'Computación',
  'Tareas y participación',
  'Materiales'
];

async function ensureStudent() {
  const docRef = db.collection(GRADES_COLLECTION).doc(STUDENT_ID);
  await docRef.set({
    childId: STUDENT_ID,
    childName: STUDENT_NAME,
    anioEscolar: '2025-2026',
    grade: 'Maternal',
    group: 'maternal',
    materias: DEFAULT_SUBJECTS.map(nombre => ({
      nombre,
      calificaciones: Object.fromEntries(BIMESTRES.map(b => [b, null]))
    })),
    // Limpiamos campos del esquema anterior (name/calificaciones como mapa) si existían
    name: admin.firestore.FieldValue.delete(),
    calificaciones: admin.firestore.FieldValue.delete()
  }, { merge: true });
  console.log(`Alumno en "grades" listo: ${STUDENT_NAME} (id: ${STUDENT_ID}).`);
}

async function listAllUsers() {
  const users = [];
  let nextPageToken;
  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    users.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  return users;
}

async function ensureEnrollment(user) {
  const existing = await db.collection(ENROLLMENTS_COLLECTION)
    .where('parentId', '==', user.uid)
    .where('studentCode', '==', STUDENT_CODE)
    .limit(1)
    .get();

  if (!existing.empty) {
    console.log(`Ya existía inscripción para ${user.email || user.uid}.`);
    return;
  }

  await db.collection(ENROLLMENTS_COLLECTION).add({
    parentId: user.uid,
    parentEmail: user.email || '',
    parentName: user.displayName || '',
    parentPhone: user.phoneNumber || '',
    studentName: STUDENT_NAME,
    studentCode: STUDENT_CODE,
    status: 'approved',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`Creada inscripción para ${user.email || user.uid}.`);
}

async function run() {
  if (!db) {
    console.error('No se pudo inicializar Firestore. Revisa las credenciales.');
    process.exit(1);
  }

  await ensureStudent();

  const users = await listAllUsers();
  console.log(`Encontradas ${users.length} cuentas registradas en Firebase Auth.`);

  for (const user of users) {
    await ensureEnrollment(user);
  }

  console.log('Listo.');
  process.exit(0);
}

run().catch(err => {
  console.error('Error ejecutando el script:', err);
  process.exit(1);
});
