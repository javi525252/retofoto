// Notificaciones push (OneSignal). Si no se ha configurado VITE_ONESIGNAL_APP_ID
// (variable de entorno), estas funciones simplemente no hacen nada: la app
// funciona igual, solo que sin avisos push.

const APP_ID = window.ONESIGNAL_APP_ID;

export function notificacionesConfiguradas() {
  return Boolean(APP_ID) && !APP_ID.startsWith("%");
}

let iniciado = false;

export function iniciarNotificaciones() {
  if (iniciado || !notificacionesConfiguradas()) return;
  iniciado = true;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    await OneSignal.init({
      appId: APP_ID,
      serviceWorkerPath: "sw.js",
      serviceWorkerParam: { scope: "/" },
    });
  });
}

export function pedirPermisoNotificaciones() {
  return new Promise((resolve) => {
    if (!notificacionesConfiguradas()) {
      resolve("no-configurado");
      return;
    }
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission();
        resolve(OneSignal.Notifications.permission ? "concedido" : "denegado");
      } catch {
        resolve("error");
      }
    });
  });
}
