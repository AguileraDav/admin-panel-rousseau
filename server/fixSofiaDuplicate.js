// Script de un solo uso: corrige el error del script anterior (seedSofiaPerez.js),
// que creó un documento duplicado de "Sofia Perez" con un esquema inventado.
// Este script:
// 1) Borra el doc duplicado "sofia-perez" en la colección "grades".
// 2) Actualiza las inscripciones que apuntaban a ese duplicado (studentCode ROUSS-2026-002)
//    para que en su lugar apunten a la Sofia Perez real ya existente en "grades".
// Ejecutar con: node fixSofiaDuplicate.js
const { db } = require('./firebase');

const GRADES_COLLECTION = 'grades';
const ENROLLMENTS_COLLECTION = 'inscripciones';

const DUPLICATE_ID = 'sofia-perez';
const OLD_STUDENT_CODE = 'ROUSS-2026-002';

const REAL_STUDENT_DOC_ID = 'YjdattazGHUCqVTKKVOc';
const REAL_STUDENT_CHILD_ID = '5sJBvBDjUdkK14xNI86f';

async function run() {
  if (!db) {
    console.error('No se pudo inicializar Firestore. Revisa las credenciales.');
    process.exit(1);
  }

  // 1) Confirmamos que el alumno real existe antes de borrar nada
  const realDoc = await db.collection(GRADES_COLLECTION).doc(REAL_STUDENT_DOC_ID).get();
  if (!realDoc.exists) {
    console.error(`No se encontró el documento real (${REAL_STUDENT_DOC_ID}). Abortando sin borrar nada.`);
    process.exit(1);
  }
  console.log(`Alumno real confirmado: ${realDoc.data().childName} (doc id: ${REAL_STUDENT_DOC_ID}).`);

  // 2) Borramos el documento duplicado
  const dupRef = db.collection(GRADES_COLLECTION).doc(DUPLICATE_ID);
  const dupDoc = await dupRef.get();
  if (dupDoc.exists) {
    await dupRef.delete();
    console.log(`Borrado documento duplicado en "grades" (id: ${DUPLICATE_ID}).`);
  } else {
    console.log(`El documento duplicado (${DUPLICATE_ID}) ya no existía.`);
  }

  // 3) Actualizamos las inscripciones que apuntaban al duplicado para que apunten al alumno real
  const snapshot = await db.collection(ENROLLMENTS_COLLECTION)
    .where('studentCode', '==', OLD_STUDENT_CODE)
    .get();

  console.log(`Encontradas ${snapshot.size} inscripciones apuntando al duplicado.`);

  for (const doc of snapshot.docs) {
    await doc.ref.update({
      studentCode: REAL_STUDENT_CHILD_ID,
      studentId: REAL_STUDENT_DOC_ID
    });
    console.log(`Actualizada inscripción ${doc.id} -> ahora apunta a la Sofia real.`);
  }

  console.log('Listo.');
  process.exit(0);
}

run().catch(err => {
  console.error('Error ejecutando el script:', err);
  process.exit(1);
});
