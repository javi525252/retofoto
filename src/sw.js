// Service worker de Retofoto: combina el caché de la PWA (workbox) con el
// worker de OneSignal para las notificaciones push, en un único archivo
// (los navegadores solo permiten un service worker activo por sitio).

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js");

import { precacheAndRoute } from "workbox-precaching";

precacheAndRoute(self.__WB_MANIFEST);

// Cuando hay una versión nueva, que se active enseguida en vez de esperar a que
// se cierren todas las pestañas (así los despliegues se notan sin tener que
// borrar caché a mano).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
