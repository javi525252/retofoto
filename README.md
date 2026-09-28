# Retofoto

PWA (React + Vite) tipo BeReal por temática: cada día un reto de foto, grupos cerrados
(amigos, familia, oficina), y solo ves las fotos de tu grupo después de subir la tuya.

El reto lo genera una IA cada día con mucha variedad (nunca repite frase), usando Supabase
como base de datos/cuentas/almacenamiento y una función de Netlify como puente seguro con
la IA (la clave nunca llega al navegador).

## Estructura

```
src/App.jsx                        Toda la app: login, grupos, reto del día, feed
src/lib/supabase.js                Cliente de Supabase
src/lib/image.js                   Compresión de fotos en el dispositivo
netlify/functions/_reto.js         Prompt del reto + sorteo de variedad
netlify/functions/reto-hoy.js      Da el reto de hoy (lo genera si no existe aún)
netlify/functions/generar-reto.js  Programada: genera el reto por adelantado cada mañana
supabase/schema.sql                Tablas, seguridad (RLS) y política del almacenamiento
```

## Cómo funciona la mecánica

- El reto es el mismo para todos los grupos cada día (como en BeReal), pero **las fotos
  solo se ven dentro de tu grupo cerrado**.
- No hay notificación push en esta primera versión: el reto está disponible en cuanto
  alguien abre la app ese día. Al pulsar "Empezar el reto" arranca un contador personal
  de 2 minutos; pasado ese tiempo puedes subir igualmente, pero queda marcado como "tarde".
- Hasta que no subes tu foto, no ves las de tu grupo (RLS de Supabase lo obliga a nivel
  de base de datos, no solo en la pantalla).
- Cambiar el límite de tiempo: `VENTANA_SEGUNDOS` en `src/App.jsx`.

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com), crea una cuenta y un proyecto nuevo (elige
   una región cercana, ej. Frankfurt).
2. Cuando esté listo, ve a **SQL Editor** → **New query**, pega todo el contenido de
   `supabase/schema.sql` y pulsa **Run**.
3. Ve a **Storage** → **New bucket** → nombre `fotos` → **NO marques "Public bucket"** → Create.
4. Ve a **Authentication → Sign In / Providers → Email** y comprueba que está activado.
   Si quieres que la gente entre sin confirmar el email (más cómodo entre amigos), en
   **Authentication → Settings** puedes desactivar "Confirm email" (opcional).
5. Ve a **Project Settings → API** y apunta estos tres valores, los necesitas ahora mismo:
   - **Project URL** (`SUPABASE_URL`)
   - **anon public key** (`SUPABASE_ANON_KEY`)
   - **service_role key** (`SUPABASE_SERVICE_ROLE_KEY`) — ⚠️ esta es secreta, nunca la pongas
     en el código del navegador, solo en las variables de entorno de Netlify.

## 2. Probar en local (PowerShell)

```powershell
npm install
npm install -g netlify-cli
$env:VITE_SUPABASE_URL = "https://tuproyecto.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = "..."
$env:SUPABASE_URL = "https://tuproyecto.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "..."
$env:ANTHROPIC_API_KEY = "sk-ant-..."
netlify dev
```

Abre http://localhost:8888.

## 3. Subir a GitHub

```powershell
cd D:\retofoto
git init
git add .
git commit -m "Retofoto: primera version"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/retofoto.git
git push -u origin main
```

## 4. Desplegar en Netlify

1. En Netlify: **Add new project → Import an existing project → GitHub** → elige `retofoto`.
   (Si no aparece el repo, entra en "Configure the Netlify app on GitHub" → Repository
   access → añade `retofoto` → Save → vuelve a Netlify).
2. Build command: `npm run build` · Publish directory: `dist` (Netlify ya lo detecta por
   `netlify.toml`).
3. Antes de desplegar, añade estas variables de entorno (**Add environment variables**),
   marcando como secretas las que lo son:
   - `VITE_SUPABASE_URL` → tu Project URL
   - `VITE_SUPABASE_ANON_KEY` → tu anon public key
   - `SUPABASE_URL` → tu Project URL (igual que arriba)
   - `SUPABASE_SERVICE_ROLE_KEY` → tu service_role key (🔒 secreta)
   - `ANTHROPIC_API_KEY` → tu clave de Anthropic (🔒 secreta)
   - `ANTHROPIC_MODEL` (opcional, por defecto `claude-haiku-4-5-20251001`)
4. Deploy. Cuando termine, ya tienes tu URL (`algo.netlify.app`).

Cada vez que hagas `git push`, Netlify redespliega solo.

## Reacciones, comentarios, racha y clasificación

Además del reto diario, la app tiene:

- **Reacciones**: cada foto del feed tiene 6 emoji para reaccionar (uno por persona, se puede
  cambiar o quitar tocando otra vez).
- **Comentarios**: cada foto tiene un apartado de comentarios cortos (200 caracteres) debajo.
- **Racha**: si has subido foto varios días seguidos en un grupo, se muestra "🔥 Racha: N días"
  en cuanto desbloqueas el feed de ese día.
- **Clasificación semanal**: botón "🏆 Clasificación" dentro de cada grupo — puntos de los
  últimos 7 días (15 puntos si subes a tiempo, 5 si vas tarde), con medallas para el top 3.

Todo esto vive en dos tablas nuevas (`reacciones`, `comentarios`) protegidas con la misma
regla de siempre: solo se ven si eres miembro del grupo y ya has subido tu foto de hoy.
Si añades estas funciones a un proyecto ya desplegado, ejecuta una vez
`supabase/migracion_2_interaccion.sql` en el SQL Editor de Supabase (no borra nada, solo añade
las tablas y sus políticas).

## Notificaciones push (OneSignal)

Aviso al móvil de "ya está el reto de hoy" en cuanto se genera, sin depender de que
cada uno abra la app. Es opcional: si no configuras las variables de abajo, la app
funciona exactamente igual, solo que sin este aviso.

1. Crea una cuenta gratis en [onesignal.com](https://onesignal.com) y una app de tipo
   **Web Push**, apuntando a tu URL de Netlify (`https://tuapp.netlify.app`).
2. En **Settings → Keys & IDs** copia el **App ID** y la **REST API Key**.
3. Añade estas variables de entorno en Netlify (además de las 5 de siempre):
   - `VITE_ONESIGNAL_APP_ID` → el App ID (no es secreta, se usa en el navegador)
   - `ONESIGNAL_REST_API_KEY` → la REST API Key (🔒 secreta, marca la casilla)
4. Vuelve a desplegar.
5. En la app, entra en un grupo → ⚙️ Ajustes → **"🔔 Activar notificaciones"** y acepta
   el permiso del navegador/móvil. Repite esto en cada dispositivo desde el que quieras
   recibir avisos.

Cómo funciona: cada vez que se genera un reto nuevo (el primero que abre la app ese
día, o la función programada de las 08:00), se manda un push a todo el que tenga las
notificaciones activadas. Como el reto es el mismo para todos los grupos, no hace
falta segmentar por grupo.

## Ajustes rápidos

- **Horario del reto**: la función programada `generar-reto.js` corre a las 08:00 UTC.
  Cámbialo editando el cron al final del archivo (`schedule("0 8 * * *", handler)`).
  No es crítico: si por lo que sea no corre, `reto-hoy.js` genera el reto igualmente en
  cuanto el primero abra la app ese día.
- **Duración del reto personal**: `VENTANA_SEGUNDOS` en `src/App.jsx` (120 por defecto).
- **Variedad de retos**: listas `CATEGORIAS`, `FORMATOS`, `TONOS`, `RESTRICCIONES` en
  `netlify/functions/_reto.js`. Añade líneas para más variedad; la IA además consulta
  los últimos 60 retos para no repetirse.
- **Cuántos avatares hay para elegir**: `EMOJIS_AVATAR` en `src/App.jsx`.

## Pendiente / ideas para más adelante

- **Play Store**: `npm install @capacitor/core @capacitor/cli @capacitor/android`,
  `npx cap init`, `npx cap add android`, y apunta las llamadas de `/api/...` a la URL
  absoluta de Netlify (en Capacitor no hay redirección relativa).
- Antes de compartirlo con más gente, pon un tope de gasto en console.anthropic.com
  (Settings → Limits), igual que en Vibezz.
