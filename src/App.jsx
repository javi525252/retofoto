import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "./lib/supabase.js";
import { compressImage, loadImageFromFile } from "./lib/image.js";

const VENTANA_SEGUNDOS = 120; // 2 minutos, el "reto" personal desde que pulsas Empezar
const EMOJIS_AVATAR = ["🙂", "😎", "🦊", "🐼", "🌵", "🍩", "🐸", "🦄", "🐙", "🐝", "🌙", "⚡"];

function hoyISO() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

function generarCodigo() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos
  let c = "";
  for (let i = 0; i < 6; i++) c += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return c;
}

export default function App() {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [grupos, setGrupos] = useState(null); // lista de {id, nombre, codigo}
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [vista, setVista] = useState("grupos"); // grupos | grupo | ajustes-grupo
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!supabaseConfigurado) {
      setCargando(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sesion) {
      setPerfil(null);
      return;
    }
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", sesion.user.id).maybeSingle();
      setPerfil(data);
    })();
  }, [sesion]);

  useEffect(() => {
    if (!sesion || !perfil) return;
    cargarGrupos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion, perfil]);

  async function cargarGrupos() {
    const { data, error: e } = await supabase
      .from("miembros")
      .select("grupo_id, grupos(id, nombre, codigo)")
      .eq("user_id", sesion.user.id);
    if (e) {
      setError(e.message);
      return;
    }
    setGrupos((data || []).map((m) => m.grupos).filter(Boolean));
  }

  if (!supabaseConfigurado) {
    return (
      <div className="app">
        <main className="screen">
          <p className="error">
            Falta configurar Supabase: define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> como
            variables de entorno (mira el README).
          </p>
        </main>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="app">
        <main className="screen center">
          <div className="orb" />
        </main>
      </div>
    );
  }

  if (!sesion) return <Login />;
  if (!perfil) return <CrearPerfil sesion={sesion} onListo={setPerfil} />;

  if (vista === "grupo" && grupoActivo) {
    return (
      <Grupo
        grupo={grupoActivo}
        perfil={perfil}
        onVolver={() => setVista("grupos")}
        onAjustes={() => setVista("ajustes-grupo")}
      />
    );
  }

  if (vista === "ajustes-grupo" && grupoActivo) {
    return (
      <AjustesGrupo
        grupo={grupoActivo}
        perfil={perfil}
        onVolver={() => setVista("grupo")}
        onSalido={() => {
          setGrupoActivo(null);
          setVista("grupos");
          cargarGrupos();
        }}
      />
    );
  }

  return (
    <ListaGrupos
      grupos={grupos}
      perfil={perfil}
      error={error}
      aviso={aviso}
      setError={setError}
      setAviso={setAviso}
      onEntrar={(g) => {
        setGrupoActivo(g);
        setVista("grupo");
      }}
      onCreado={cargarGrupos}
    />
  );
}

// ============= LOGIN =============

function Login() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviarEnlace(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const { error: e2 } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: location.origin },
    });
    setEnviando(false);
    if (e2) setError(e2.message);
    else setEnviado(true);
  }

  return (
    <div className="app">
      <main className="screen home">
        <header className="brand">
          <span className="spark">✦</span> retofoto
        </header>
        <h1>
          Un reto al día. <em>Solo tu grupo.</em>
        </h1>
        <p className="lead">Una palabra o reto cada día. Subes tu foto en un par de minutos y desbloqueas las del grupo.</p>

        {enviado ? (
          <p className="aviso">
            📬 Te hemos enviado un enlace a <b>{email}</b>. Ábrelo desde este mismo dispositivo para entrar.
          </p>
        ) : (
          <form onSubmit={enviarEnlace} className="actions">
            <input
              className="input"
              type="email"
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn primary" disabled={enviando} type="submit">
              {enviando ? "Enviando…" : "Entrar con email"}
            </button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
        <p className="privacy">🔒 Sin contraseña: te mandamos un enlace mágico a tu correo.</p>
      </main>
    </div>
  );
}

// ============= CREAR PERFIL =============

function CrearPerfil({ sesion, onListo }) {
  const [nombre, setNombre] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS_AVATAR[0]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setGuardando(true);
    setError("");
    const { data, error: e2 } = await supabase
      .from("profiles")
      .insert({ id: sesion.user.id, nombre: nombre.trim(), emoji_avatar: emoji })
      .select()
      .single();
    setGuardando(false);
    if (e2) setError(e2.message);
    else onListo(data);
  }

  return (
    <div className="app">
      <main className="screen">
        <header className="brand">
          <span className="spark">✦</span> retofoto
        </header>
        <h1>¿Cómo te llamamos?</h1>
        <p className="lead">Así te verá tu grupo junto a tus fotos.</p>
        <form onSubmit={guardar} className="actions">
          <input className="input" required placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={30} />
          <div className="scroller" role="radiogroup" aria-label="Avatar">
            {EMOJIS_AVATAR.map((em) => (
              <button
                type="button"
                key={em}
                className={"chip emoji" + (emoji === em ? " on" : "")}
                onClick={() => setEmoji(em)}
              >
                {em}
              </button>
            ))}
          </div>
          <button className="btn primary" disabled={guardando} type="submit">
            {guardando ? "Guardando…" : "Continuar"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </main>
    </div>
  );
}

// ============= LISTA DE GRUPOS =============

function ListaGrupos({ grupos, perfil, error, aviso, setError, setAviso, onEntrar, onCreado }) {
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [codigoUnirse, setCodigoUnirse] = useState("");
  const [creando, setCreando] = useState(false);
  const [uniendo, setUniendo] = useState(false);
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [mostrarUnirse, setMostrarUnirse] = useState(false);

  async function crearGrupo(e) {
    e.preventDefault();
    if (!nombreNuevo.trim()) return;
    setCreando(true);
    setError("");
    const codigo = generarCodigo();
    const { data: grupo, error: e1 } = await supabase
      .from("grupos")
      .insert({ nombre: nombreNuevo.trim(), codigo, creado_por: perfil.id })
      .select()
      .single();
    if (e1) {
      setCreando(false);
      setError(e1.message);
      return;
    }
    const { error: e2 } = await supabase.from("miembros").insert({ grupo_id: grupo.id, user_id: perfil.id });
    setCreando(false);
    if (e2) {
      setError(e2.message);
      return;
    }
    setNombreNuevo("");
    setMostrarCrear(false);
    setAviso(`Grupo "${grupo.nombre}" creado. Comparte el código ${grupo.codigo} con los tuyos.`);
    onCreado();
  }

  async function unirseGrupo(e) {
    e.preventDefault();
    const codigo = codigoUnirse.trim().toUpperCase();
    if (!codigo) return;
    setUniendo(true);
    setError("");
    const { data: grupo, error: e1 } = await supabase.from("grupos").select("*").eq("codigo", codigo).maybeSingle();
    if (e1 || !grupo) {
      setUniendo(false);
      setError("No existe ningún grupo con ese código.");
      return;
    }
    const { error: e2 } = await supabase.from("miembros").insert({ grupo_id: grupo.id, user_id: perfil.id });
    setUniendo(false);
    if (e2) {
      setError(e2.code === "23505" ? "Ya eres miembro de ese grupo." : e2.message);
      return;
    }
    setCodigoUnirse("");
    setMostrarUnirse(false);
    setAviso(`Te has unido a "${grupo.nombre}".`);
    onCreado();
  }

  return (
    <div className="app">
      <main className="screen">
        <header className="brand">
          <span className="spark">✦</span> retofoto
        </header>
        <h1>
          Hola, <em>{perfil.nombre}</em>
        </h1>

        {aviso && <p className="aviso">{aviso}</p>}
        {error && <p className="error">{error}</p>}

        {grupos === null ? (
          <p className="lead">Cargando tus grupos…</p>
        ) : grupos.length === 0 ? (
          <p className="lead">Aún no estás en ningún grupo. Crea uno o únete con un código.</p>
        ) : (
          <section className="examples">
            {grupos.map((g) => (
              <button key={g.id} className="ex ex-btn" onClick={() => onEntrar(g)}>
                <b>{g.nombre}</b>
                <span className="left">código {g.codigo}</span>
              </button>
            ))}
          </section>
        )}

        <div className="actions">
          {!mostrarCrear && !mostrarUnirse && (
            <>
              <button className="btn primary" onClick={() => setMostrarCrear(true)}>
                Crear un grupo
              </button>
              <button className="btn ghost" onClick={() => setMostrarUnirse(true)}>
                Unirme con un código
              </button>
            </>
          )}

          {mostrarCrear && (
            <form onSubmit={crearGrupo} className="actions">
              <input
                className="input"
                placeholder="Nombre del grupo (ej: Los del insti)"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                maxLength={40}
                autoFocus
              />
              <div className="actions row">
                <button className="btn primary" disabled={creando} type="submit">
                  {creando ? "Creando…" : "Crear"}
                </button>
                <button className="btn ghost" type="button" onClick={() => setMostrarCrear(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {mostrarUnirse && (
            <form onSubmit={unirseGrupo} className="actions">
              <input
                className="input codigo"
                placeholder="CÓDIGO"
                value={codigoUnirse}
                onChange={(e) => setCodigoUnirse(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus
              />
              <div className="actions row">
                <button className="btn primary" disabled={uniendo} type="submit">
                  {uniendo ? "Uniéndome…" : "Unirme"}
                </button>
                <button className="btn ghost" type="button" onClick={() => setMostrarUnirse(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

        <button className="btn link" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </main>
    </div>
  );
}

// ============= GRUPO (reto del día + feed) =============

function Grupo({ grupo, perfil, onVolver, onAjustes }) {
  const [reto, setReto] = useState(null);
  const [cargandoReto, setCargandoReto] = useState(true);
  const [miEnvio, setMiEnvio] = useState(undefined); // undefined = sin comprobar, null = no enviado
  const [envios, setEnvios] = useState(null);
  const [urls, setUrls] = useState({});
  const [empezado, setEmpezado] = useState(false);
  const [inicioTs, setInicioTs] = useState(null);
  const [restante, setRestante] = useState(VENTANA_SEGUNDOS);
  const [mostrarPista, setMostrarPista] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    cargarReto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!empezado) return;
    const t = setInterval(() => {
      setRestante((r) => Math.max(0, VENTANA_SEGUNDOS - Math.floor((Date.now() - inicioTs) / 1000)));
    }, 500);
    return () => clearInterval(t);
  }, [empezado, inicioTs]);

  async function cargarReto() {
    setCargandoReto(true);
    setError("");
    try {
      const res = await fetch("/api/reto-hoy");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se ha podido cargar el reto de hoy.");
      setReto(data);
      await comprobarEnvio(data.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoReto(false);
    }
  }

  async function comprobarEnvio(retoId) {
    const { data } = await supabase
      .from("envios")
      .select("*")
      .eq("reto_id", retoId)
      .eq("grupo_id", grupo.id)
      .eq("user_id", perfil.id)
      .maybeSingle();
    setMiEnvio(data || null);
    if (data) cargarFeed(retoId);
  }

  async function cargarFeed(retoId) {
    const { data, error: e } = await supabase
      .from("envios")
      .select("*, profiles(nombre, emoji_avatar)")
      .eq("reto_id", retoId)
      .eq("grupo_id", grupo.id)
      .order("segundos_tardados", { ascending: true });
    if (e) {
      setError(e.message);
      return;
    }
    setEnvios(data || []);
    const nuevas = {};
    for (const en of data || []) {
      const { data: signed } = await supabase.storage.from("fotos").createSignedUrl(en.foto_path, 3600);
      if (signed) nuevas[en.id] = signed.signedUrl;
    }
    setUrls(nuevas);
  }

  function empezar() {
    setEmpezado(true);
    setInicioTs(Date.now());
    setRestante(VENTANA_SEGUNDOS);
  }

  async function subirFoto(file) {
    if (!file || !reto) return;
    setSubiendo(true);
    setError("");
    try {
      const img = await loadImageFromFile(file);
      const blob = await compressImage(img, 1280, 0.82);
      const segundos = inicioTs ? Math.round((Date.now() - inicioTs) / 1000) : null;
      const path = `${grupo.id}/${reto.id}/${perfil.id}/foto.jpg`;
      const { error: eUp } = await supabase.storage.from("fotos").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (eUp) throw eUp;
      const { data: envio, error: eIns } = await supabase
        .from("envios")
        .insert({ reto_id: reto.id, grupo_id: grupo.id, user_id: perfil.id, foto_path: path, segundos_tardados: segundos })
        .select()
        .single();
      if (eIns) throw eIns;
      setMiEnvio(envio);
      await cargarFeed(reto.id);
    } catch (e) {
      setError(e.message || "No se ha podido subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  const minSec = useMemo(() => {
    const m = Math.floor(restante / 60);
    const s = restante % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [restante]);

  return (
    <div className="app">
      <main className="screen">
        <header className="brand row-between">
          <span>
            <span className="spark">✦</span> {grupo.nombre}
          </span>
          <div className="header-btns">
            <button className="icon-btn" onClick={onAjustes} aria-label="Ajustes del grupo">
              ⚙️
            </button>
            <button className="icon-btn" onClick={onVolver} aria-label="Volver a mis grupos">
              ✕
            </button>
          </div>
        </header>

        {cargandoReto && <p className="lead">Buscando el reto de hoy…</p>}
        {error && <p className="error">{error}</p>}

        {reto && miEnvio === null && (
          <>
            <div className="reto-card">
              <span className="reto-emoji">{reto.emoji}</span>
              <h1>{reto.texto}</h1>
              {mostrarPista ? (
                <p className="lead">💡 {reto.pista}</p>
              ) : (
                <button className="btn link" onClick={() => setMostrarPista(true)}>
                  Necesito una pista
                </button>
              )}
            </div>

            {!empezado ? (
              <div className="actions">
                <button className="btn primary" onClick={empezar}>
                  Empezar el reto ({VENTANA_SEGUNDOS / 60} min)
                </button>
                <p className="privacy">No verás las fotos del grupo hasta que subas la tuya.</p>
              </div>
            ) : (
              <div className="actions">
                <p className="timer" aria-live="polite">
                  ⏱ {minSec} {restante === 0 && "— se acabó el tiempo, pero puedes subir igualmente"}
                </p>
                <button className="btn primary" disabled={subiendo} onClick={() => fileRef.current?.click()}>
                  {subiendo ? "Subiendo…" : "Sube tu foto"}
                </button>
                <button className="btn ghost" disabled={subiendo} onClick={() => cameraRef.current?.click()}>
                  Hacer una foto
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                subirFoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                subirFoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </>
        )}

        {reto && miEnvio && (
          <>
            <div className="reto-card small">
              <span className="reto-emoji">{reto.emoji}</span>
              <b>{reto.texto}</b>
            </div>
            <p className="label">
              {envios ? `${envios.length} ${envios.length === 1 ? "foto" : "fotos"} de hoy` : "Cargando el grupo…"}
            </p>
            <section className="feed">
              {envios?.map((en) => (
                <figure className="feed-item" key={en.id}>
                  {urls[en.id] ? <img src={urls[en.id]} alt={`Foto de ${en.profiles?.nombre}`} /> : <div className="feed-skel" />}
                  <figcaption>
                    <span>
                      {en.profiles?.emoji_avatar} {en.profiles?.nombre}
                    </span>
                    {typeof en.segundos_tardados === "number" && (
                      <span className="left">{en.segundos_tardados <= VENTANA_SEGUNDOS ? "a tiempo" : `+${en.segundos_tardados - VENTANA_SEGUNDOS}s tarde`}</span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// ============= AJUSTES DEL GRUPO =============

function AjustesGrupo({ grupo, perfil, onVolver, onSalido }) {
  const [miembros, setMiembros] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase
        .from("miembros")
        .select("user_id, profiles(nombre, emoji_avatar)")
        .eq("grupo_id", grupo.id);
      if (e) setError(e.message);
      else setMiembros(data || []);
    })();
  }, [grupo.id]);

  async function compartirCodigo() {
    const texto = `Únete a "${grupo.nombre}" en Retofoto con el código ${grupo.codigo}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
      } catch {
        /* cancelado */
      }
    } else {
      await navigator.clipboard.writeText(texto);
    }
  }

  async function salir() {
    const { error: e } = await supabase.from("miembros").delete().eq("grupo_id", grupo.id).eq("user_id", perfil.id);
    if (e) setError(e.message);
    else onSalido();
  }

  return (
    <div className="app">
      <main className="screen">
        <header className="brand row-between">
          <span>Ajustes</span>
          <button className="icon-btn" onClick={onVolver} aria-label="Volver">
            ✕
          </button>
        </header>
        <h1>{grupo.nombre}</h1>
        <div className="reto-card small">
          <span>Código de invitación</span>
          <b className="codigo-grande">{grupo.codigo}</b>
          <button className="btn ghost" onClick={compartirCodigo}>
            Compartir código
          </button>
        </div>

        <p className="label">Miembros</p>
        <section className="examples">
          {miembros?.map((m) => (
            <div className="ex" key={m.user_id}>
              <b>
                {m.profiles?.emoji_avatar} {m.profiles?.nombre}
              </b>
            </div>
          ))}
        </section>

        {error && <p className="error">{error}</p>}
        <button className="btn link" onClick={salir}>
          Salir del grupo
        </button>
      </main>
    </div>
  );
}
