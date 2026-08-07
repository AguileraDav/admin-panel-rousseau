# Backend Express para eventos (Firebase)

Pasos para configurar y ejecutar el backend que guarda eventos en Firestore.

La colección usada para almacenar los eventos se llama `events`.

1) Crear proyecto Firebase y habilitar Firestore

- Ve a https://console.firebase.google.com/ y crea un proyecto (o usa uno existente).
- En el panel del proyecto, activa Firestore (modo de producción o modo de prueba según prefieras).

2) Crear una cuenta de servicio y descargar la clave JSON

- Ve a 'Configuración del proyecto' → 'Cuentas de servicio' → 'Generar nueva clave privada'.
- Descarga el archivo JSON y guárdalo de forma segura.

3) Colocar la clave en el servidor (dos opciones)

- Opción A (archivo local - desarrollo): Copia el JSON descargado como `server/serviceAccountKey.json`. Asegúrate de que `server/.gitignore` incluye ese archivo (ya está añadido).
- Opción B (producción / CI): establece la variable de entorno `GOOGLE_APPLICATION_CREDENTIALS` con la ruta absoluta al JSON en tu entorno. Por ejemplo:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/a/tu/service-account.json"
```

4) Instalar dependencias e iniciar

```bash
cd server
npm install
npm start
```

El servidor escucha por defecto en el puerto `3000`.

5) Probar endpoints

- Crear evento (ejemplo con `curl`):

```bash
curl -X POST http://localhost:3000/api/events \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-07-10","name":"Prueba","description":"Descripción de prueba"}'
```

- Listar eventos:

```bash
curl http://localhost:3000/api/events
```

6) Integrar con el frontend

- Si el frontend se sirve en otro origen, `client/app.js` hace `fetch('/api/events')`. Si abres el `client/index.html` directamente en el navegador (file://) ajusta la URL a `http://localhost:3000/api/events`.

7) Seguridad

- No subas `serviceAccountKey.json` a repositorios públicos.
- Restringe el acceso a la cuenta de servicio en IAM según el principio de privilegio mínimo.

8) Envío de correo con el QR de inscripción

El endpoint `POST /api/inscripciones` acepta un campo opcional `qrImage` (data URL de una imagen). Si se envía, además de guardarse en la inscripción, se manda por correo al `parentEmail` con el QR adjunto para que el padre/madre/tutor pueda acceder a la app.

Configura estas variables de entorno (por ejemplo en `server/.env`, ya está en `.gitignore`):

```
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=contraseña_de_aplicacion_de_gmail
```

`EMAIL_PASS` debe ser una "contraseña de aplicación" de Gmail (no la contraseña normal de la cuenta); se genera en la configuración de seguridad de la cuenta de Google con la verificación en dos pasos activada.
