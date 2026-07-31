const express = require('express');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { admin, db } = require('../firebase');

const router = express.Router();

// Nombre de la colección donde se guardan los pagos de los alumnos
const PAYMENTS_COLLECTION = 'payments';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN, // "TEST-xxxxxxxx..." en sandbox
});

// Crea una preferencia de pago en Mercado Pago (sandbox) para que la app abra el checkout
router.post('/create_preference', async (req, res) => {
  const { description, price, userId, paymentIds } = req.body || {};
  if (!description || !price || !userId) {
    return res.status(400).json({ error: 'Falta description, price o userId' });
  }

  try {
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [
          {
            title: description,
            quantity: 1,
            unit_price: Number(price),
            currency_id: 'MXN',
          },
        ],
        metadata: { userId, paymentIds },
        back_urls: {
          success: 'rousseauapp://payment/success',
          failure: 'rousseauapp://payment/failure',
          pending: 'rousseauapp://payment/pending',
        },
        auto_return: 'approved',
        notification_url: `${process.env.BACKEND_URL}/mp_webhook`,
      },
    });

    res.json({ id: result.id, initPoint: result.init_point });
  } catch (err) {
    console.error('Error creando preferencia de Mercado Pago:', err);
    res.status(500).json({ error: 'No se pudo crear la preferencia' });
  }
});

// Webhook de Mercado Pago: confirma el pago y actualiza Firestore
router.post('/mp_webhook', async (req, res) => {
  try {
    const { type, data } = req.query.type ? req.query : req.body;

    if (type === 'payment' && data && data.id) {
      const payment = new Payment(client);
      const info = await payment.get({ id: data.id });

      if (info.status === 'approved' && db) {
        // Mercado Pago normaliza las claves de metadata a snake_case/minúsculas al guardarlas
        const meta = info.metadata || {};
        const userId = meta.userId || meta.user_id || null;
        const paymentIds = meta.paymentIds || meta.payment_ids;

        const paidData = {
          status: 'pagado',
          userId,
          mpPaymentId: info.id,
          description: info.description || (info.additional_info && info.additional_info.items && info.additional_info.items[0] && info.additional_info.items[0].title) || 'Pago',
          amount: info.transaction_amount,
          currency: info.currency_id,
          payerEmail: (info.payer && info.payer.email) || null,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (Array.isArray(paymentIds) && paymentIds.length > 0) {
          const batch = db.batch();
          paymentIds.forEach((paymentId) => {
            const ref = db.collection(PAYMENTS_COLLECTION).doc(paymentId);
            batch.set(ref, paidData, { merge: true });
          });
          await batch.commit();
        } else {
          // Sin paymentIds pre-existentes (ej. pago de prueba directo desde la app):
          // se crea el registro usando el id del pago de Mercado Pago para no duplicarlo si el webhook reintenta.
          await db.collection(PAYMENTS_COLLECTION).doc(String(info.id)).set(paidData, { merge: true });
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Error procesando webhook de Mercado Pago:', err);
    // Responder 200 igual: MP reintenta si no recibe 200, y no queremos reintentos infinitos por errores no recuperables
    res.sendStatus(200);
  }
});

// Lista los pagos registrados, más recientes primero (para el dashboard)
router.get('/api/payments', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Base de datos no inicializada' });
  try {
    const snapshot = await db.collection(PAYMENTS_COLLECTION).orderBy('paidAt', 'desc').limit(100).get();
    const payments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ payments });
  } catch (err) {
    console.error('Error leyendo pagos:', err);
    res.status(500).json({ error: 'Error al leer los pagos' });
  }
});

module.exports = router;
