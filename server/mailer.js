const nodemailer = require('nodemailer');

// Transportador de correo configurado por variables de entorno.
// EMAIL_USER / EMAIL_PASS: cuenta de Gmail (usar una "contraseña de aplicación").
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
} else {
  console.warn('EMAIL_USER/EMAIL_PASS no definidos: el envío de correos con el QR estará deshabilitado.');
}

// Envía el correo con el código QR de acceso al padre/madre/tutor.
// qrBuffer: Buffer con la imagen del QR. qrMimeType: tipo MIME de la imagen (image/png, image/jpeg, etc).
async function sendEnrollmentQrEmail({ to, studentName, parentName, qrBuffer, qrMimeType }) {
  if (!transporter) throw new Error('El servicio de correo no está configurado');

  const extension = (qrMimeType && qrMimeType.split('/')[1]) || 'png';

  await transporter.sendMail({
    from: `"Colegio Rousseau" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Código QR de acceso - ${studentName}`,
    html: `
      <p>Hola ${parentName || ''},</p>
      <p>La inscripción del alumno <strong>${studentName}</strong> ha sido registrada correctamente.</p>
      <p>Adjuntamos el código QR que deberás usar para acceder a la aplicación del colegio.</p>
      <p><img src="cid:enrollmentQr" alt="Código QR de acceso" style="width:220px;height:220px;" /></p>
    `,
    attachments: [
      {
        filename: `qr-acceso.${extension}`,
        content: qrBuffer,
        contentType: qrMimeType || 'image/png',
        cid: 'enrollmentQr'
      }
    ]
  });
}

module.exports = { sendEnrollmentQrEmail };
