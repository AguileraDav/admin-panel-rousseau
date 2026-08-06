// Script de un solo uso: normaliza los nombres de las materias de Sofia Perez
// (colección "grades") para que coincidan exactamente con la lista oficial,
// y renombra la clave "Ingles" -> "Inglés" dentro de cada bimestre para que
// las calificaciones ya guardadas sigan coincidiendo con el nombre de materia.
// Ejecutar con: node fixSofiaMaterias.js
const { db } = require('./firebase');

const GRADES_COLLECTION = 'grades';
const STUDENT_DOC_ID = 'YjdattazGHUCqVTKKVOc';

const MATERIAS = [
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

const RENAMES = { 'Ingles': 'Inglés' };
const COLOR_FIXES = { amarilla: 'amarillo', verde: 'verde', amarillo: 'amarillo', rojo: 'rojo' };

async function run() {
  if (!db) {
    console.error('No se pudo inicializar Firestore. Revisa las credenciales.');
    process.exit(1);
  }

  const docRef = db.collection(GRADES_COLLECTION).doc(STUDENT_DOC_ID);
  const doc = await docRef.get();
  if (!doc.exists) {
    console.error(`No se encontró el documento ${STUDENT_DOC_ID}.`);
    process.exit(1);
  }

  const data = doc.data();
  const bimestres = data.bimestres || {};

  const newBimestres = {};
  for (const [bimestre, entry] of Object.entries(bimestres)) {
    const newEntry = {};
    for (const [key, value] of Object.entries(entry)) {
      const newKey = RENAMES[key] || key;
      // Si el valor es un color, lo limpiamos (trim + minúsculas) y corregimos errores de tipeo
      if (typeof value === 'string') {
        const cleaned = value.trim().toLowerCase();
        newEntry[newKey] = COLOR_FIXES[cleaned] || cleaned;
      } else {
        newEntry[newKey] = value;
      }
    }
    newBimestres[bimestre] = newEntry;
  }

  await docRef.update({ materias: MATERIAS, bimestres: newBimestres });
  console.log('Materias y bimestres normalizados correctamente.');

  const updated = await docRef.get();
  console.log(JSON.stringify(updated.data(), null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error('Error ejecutando el script:', err);
  process.exit(1);
});
