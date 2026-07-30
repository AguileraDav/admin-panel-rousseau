const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { admin, db } = require('./firebase');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors());
app.use(express.json());

// Nombre de la colección donde se guardan los eventos del calendario
const EVENTS_COLLECTION = 'events';

// Nombre de la colección donde se guarda el menú semanal de alimentos
const MENU_COLLECTION = 'menu_semanal';

// Nombre de la colección donde se guardan los periodos del calendario académico
const CALENDAR_COLLECTION = 'calendar';

// Nombre de la colección donde se guardan las cuentas con acceso al panel
const ADMINS_COLLECTION = 'admins';

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Backend de eventos funcionando' });
});

// Endpoint de login: valida correo y contraseña contra la colección "admins"
app.post('/api/login', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Base de datos no inicializada' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Falta correo o contraseña' });

  try {
    const snapshot = await db.collection(ADMINS_COLLECTION)
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(401).json({ error: 'Credenciales inválidas' });

    const account = snapshot.docs[0].data();
    const match = await bcrypt.compare(password, account.passwordHash);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign({ email: account.email, role: account.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, email: account.email, role: account.role });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Endpoint para crear evento
app.post('/api/events', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Base de datos no inicializada' });

  const { date, name, description } = req.body || {};
  if (!date || !name) return res.status(400).json({ error: 'Falta fecha o nombre del evento' });

  try {
    const docRef = await db.collection(EVENTS_COLLECTION).add({
      date,
      name,
      description: description || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const doc = await docRef.get();
    res.status(201).json({ id: docRef.id, data: doc.data() });
  } catch (err) {
    console.error('Error guardando evento:', err);
    res.status(500).json({ error: 'Error al guardar el evento' });
  }
});

// Endpoint para listar eventos (útil para pruebas)
app.get('/api/events', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Base de datos no inicializada' });
  try {
    const snapshot = await db.collection(EVENTS_COLLECTION).orderBy('createdAt', 'desc').limit(50).get();
    const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ events });
  } catch (err) {
    console.error('Error leyendo eventos:', err);
    res.status(500).json({ error: 'Error al leer eventos' });
  }
});

// Endpoint para enviar el menú semanal completo (lunes a viernes)
app.post('/api/menu', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Base de datos no inicializada' });

  const { days } = req.body || {};
  if (!days || typeof days !== 'object' || Object.keys(days).length === 0) {
    return res.status(400).json({ error: 'Falta el menú de la semana' });
  }

  try {
    // Eliminar el/los menú(s) semanal(es) anteriores antes de guardar el nuevo
    const existing = await db.collection(MENU_COLLECTION).get();
    const batch = db.batch();
    existing.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    const docRef = await db.collection(MENU_COLLECTION).add({
      days,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const doc = await docRef.get();
    res.status(201).json({ id: docRef.id, data: doc.data() });
  } catch (err) {
    console.error('Error guardando el menú semanal:', err);
    res.status(500).json({ error: 'Error al guardar el menú semanal' });
  }
});

// Endpoint para crear un periodo del calendario académico
app.post('/api/calendar', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Base de datos no inicializada' });

  const { title, color, start, end } = req.body || {};
  if (!title || !start || !end) return res.status(400).json({ error: 'Falta título, fecha de inicio o fecha de fin' });

  try {
    const docRef = await db.collection(CALENDAR_COLLECTION).add({
      title,
      color: color || '#A855F7',
      start,
      end,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const doc = await docRef.get();
    res.status(201).json({ id: docRef.id, data: doc.data() });
  } catch (err) {
    console.error('Error guardando el periodo del calendario:', err);
    res.status(500).json({ error: 'Error al guardar el periodo del calendario' });
  }
});

// Endpoint para listar los periodos del calendario académico
app.get('/api/calendar', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Base de datos no inicializada' });
  try {
    const snapshot = await db.collection(CALENDAR_COLLECTION).orderBy('createdAt', 'desc').limit(100).get();
    const periods = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ periods });
  } catch (err) {
    console.error('Error leyendo el calendario:', err);
    res.status(500).json({ error: 'Error al leer el calendario' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
