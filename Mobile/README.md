# NihongoTracker Android

This Capacitor app shares NihongoTracker's frontend and business logic. It adds a mobile layout with daisyUI and Lucide, direct sign-in, five main tabs, compact profiles and clubs, record filters, and separate settings categories.

This version installs as an Android application. Use Node 22 or newer, JDK 21, and Android SDK 36 for this package.

The Android launcher uses the NT logo from `../Frontend/public/favicon.png`. The `ic_launcher`, `ic_launcher_round`, and `ic_launcher_foreground` PNG resources cover mdpi through xxxhdpi. Adaptive foregrounds use a 108 dp canvas with the logo centered at 64 dp over the `ic_launcher_background` color.

## Local Android preview over USB

Install Android Studio with its Android SDK. Enable USB debugging on the phone and authorize this PC.

Start the local backend in a separate terminal:

Use a local `DATABASE_URL` and `NODE_ENV=development` in `Backend/.env`. The mobile session endpoints are included in this local backend; production does not need to be updated for testing.

```powershell
cd E:\Coding\NihongoTracker\Backend
npm run dev
```

In a second terminal, forward the backend port and run the app:

```powershell
adb reverse tcp:3000 tcp:3000
cd E:\Coding\NihongoTracker\Mobile
npm install
npm run android:local
```

The local build uses `http://localhost:3000/api/` through USB forwarding. If your backend uses a different port, set `VITE_API_BASE_URL` and forward that port before running the command.

If `adb` is not on PATH in Windows, use `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:3000 tcp:3000`. The phone must appear in `adb devices` and accept the USB authorization prompt.

```powershell
$env:VITE_API_BASE_URL = 'http://localhost:4000/api/'
adb reverse tcp:4000 tcp:4000
npm run android:local
```

After changing the web frontend, run `npm run android:local` again. `npm run sync:local` prepares the Android project without installing it. `npm run android` opens it in Android Studio.

To install the generated local APK without rebuilding, start the local backend and forward port 3000 as above, then run:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r 'E:\Coding\NihongoTracker\Mobile\android\app\build\outputs\apk\debug\app-debug.apk'
```

Open NihongoTracker from the phone's app list. Keep the USB connection active while using the local backend.

## Offline behavior

Sign in online once. The app keeps account-scoped page data and queues supported changes in IndexedDB. It synchronizes while open, on reconnection, and when resumed. Cached media remain available for logging. Uploads, account-security changes, and club administration require a connection.

The pending changes button opens a daisyUI dialog with server errors, retries, and discard controls. Unsent or rejected logs can be edited there. Requests with an unknown server result must be retried before editing or discarding them. Pending logs do not grant provisional XP.

The app fetches the owner's profile and recent logs, membership details, followed profiles, and an initial ranking page. Other pages and ranking filters are saved when visited. Cached images expire after 30 days and are limited to 300 per account. Media searches retain up to 500 results. Log retries use a unique server index on `(user, clientOperationId)`; future production rollout must apply the index migration first.

This build reads the sibling `../Frontend` package. After a fresh clone, install dependencies in `Frontend` and in this package.

## Local approval checklist

1. Sign in against the local backend and open home, own and other profiles, settings, customization, ranking, and club details.
2. Visit media searches and image-bearing pages while connected. Disconnect the phone's network and create a log with cached media.
3. Change safe profile preferences or cosmetics, follow a cached user, and join or leave a cached club. Confirm the pending list survives an app restart.
4. Restore the backend connection. Verify the pending list clears and the log appears once with confirmed XP.
5. Switch accounts and confirm no pending operations or cached private pages from the previous account appear.

## Release preparation

`npm run sync` packages the web frontend with the production API URL and disables development HTTP access. It does not deploy the backend or publish the app. RevenueCat and iOS publication are separate work.

## Revisión de la interfaz móvil

La cabecera mide 56 px más el margen superior del sistema. La navegación inferior y los diálogos usan los márgenes de Capacitor. El teclado oculta las pestañas y deja disponible la acción del formulario. La app abre Acceso sin sesión e Inicio con sesión, sin mostrar la landing web.

Para revisar solamente la presentación en el navegador, abre el servidor de desarrollo con `?mobilePreview=1`. Esta vista no activa los plugins, las credenciales nativas ni la caché sin conexión. La web normal conserva su navegación y su landing.

Después de instalar el APK local, revisa en el teléfono:

1. Arranque sin sesión, acceso, cierre de sesión y arranque con datos guardados sin conexión.
2. Las cinco pestañas, filtros y posición de desplazamiento al regresar.
3. Perfil propio y ajeno, configuración, personalización y detalle de un club.
4. Crear y editar registros con el teclado abierto. Volver debe pedir confirmación si hay cambios.
5. Cerrar primero teclado y diálogos con Volver. Una pestaña principal vuelve a Inicio y desde Inicio permite salir.
6. Temas claro y oscuro, orientación horizontal y navegación Android por gestos y botones. Comprueba que las barras del sistema no cubran controles.