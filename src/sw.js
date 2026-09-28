// Service worker de Retofoto: combina el caché de la PWA (workbox) con el
// worker de OneSignal para las notificaciones push, en un único archivo
// (los navegadores solo permiten un service worker activo por sitio).

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js");

import { precacheAndRoute } from "workbox-precaching";

precacheAndRoute(self.__WB_MANIFEST);
