import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Miembro } from "./supabase";
import Entrar from "./pantallas/Entrar";
import Hoy from "./pantallas/Hoy";
import Estrategia from "./pantallas/Estrategia";
import Contenido from "./pantallas/Contenido";
import Pauta from "./pantallas/Pauta";
import Leads from "./pantallas/Leads";
import Equipo from "./pantallas/Equipo";
import { Cargando } from "./ui";

type Ruta = "hoy" | "estrategia" | "contenido" | "pauta" | "leads" | "equipo";

const ICONOS: Record<Ruta, string> = {
  hoy: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  estrategia: "M12 3l9 4-9 4-9-4 9-4zM3 12l9 4 9-4M3 17l9 4 9-4",
  contenido: "M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4",
  pauta: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  leads: "M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a3 3 0 100-6 3 3 0 000 6zM22 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8",
  equipo: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 110-4h.1a1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z",
};

const NOMBRES: Record<Ruta, string> = {
  hoy: "Hoy", estrategia: "Estrategia", contenido: "Contenido", pauta: "Pauta", leads: "Leads", equipo: "Equipo",
};

function leerRuta(): Ruta {
  const r = window.location.hash.replace(/^#\/?/, "").split(/[?&]/)[0] as Ruta;
  return r in NOMBRES ? r : "hoy";
}

export default function App() {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);
  const [miembro, setMiembro] = useState<Miembro | null | undefined>(undefined);
  const [ruta, setRuta] = useState<Ruta>(leerRuta());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Al volver del enlace del correo la dirección trae el token: se limpia.
  useEffect(() => {
    if (sesion && /access_token|error_description/.test(window.location.hash)) {
      history.replaceState(null, "", window.location.pathname + "#/hoy");
      setRuta("hoy");
    }
  }, [sesion]);

  useEffect(() => {
    const cambio = () => setRuta(leerRuta());
    window.addEventListener("hashchange", cambio);
    return () => window.removeEventListener("hashchange", cambio);
  }, []);

  useEffect(() => {
    if (!sesion) { setMiembro(sesion === null ? null : undefined); return; }
    setMiembro(undefined);
    supabase.from("equipo").select("email,nombre,rol")
      .eq("email", (sesion.user.email ?? "").toLowerCase()).maybeSingle()
      .then(({ data }) => setMiembro((data as Miembro) ?? null));
  }, [sesion?.user.id]);

  useEffect(() => { window.scrollTo(0, 0); }, [ruta]);

  if (sesion === undefined) return <Cargando />;
  if (!sesion) return <Entrar />;
  if (miembro === undefined) return <Cargando />;
  if (!miembro) {
    return (
      <div className="entrar">
        <div className="entrar-caja">
          <div className="marca grande">SantaFe</div>
          <h1>Todavía no tienes acceso</h1>
          <p>Entraste como <b>{sesion.user.email}</b>, pero ese correo no está en el equipo. Pídele a Laura que lo agregue y vuelve a entrar.</p>
          <button className="boton secundario" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </div>
    );
  }

  const rutas: Ruta[] = ["hoy", "estrategia", "contenido", "pauta", "leads", ...(miembro.rol === "admin" ? ["equipo" as Ruta] : [])];
  const actual = rutas.includes(ruta) ? ruta : "hoy";

  return (
    <div className="app">
      <header className="cabecera">
        <a className="marca" href="#/hoy">SantaFe <span>equipo</span></a>
        <nav className="nav-arriba">
          {rutas.map((r) => (
            <a key={r} href={`#/${r}`} className={r === actual ? "activo" : ""}>{NOMBRES[r]}</a>
          ))}
        </nav>
        <div className="quien">
          <span title={miembro.email}>{miembro.nombre?.split(" ")[0] ?? miembro.email}</span>
          <button className="enlace" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>

      <main className="contenido">
        {actual === "hoy" && <Hoy />}
        {actual === "estrategia" && <Estrategia miembro={miembro} />}
        {actual === "contenido" && <Contenido />}
        {actual === "pauta" && <Pauta />}
        {actual === "leads" && <Leads miembro={miembro} />}
        {actual === "equipo" && <Equipo miembro={miembro} />}
      </main>

      <nav className="nav-abajo">
        {rutas.map((r) => (
          <a key={r} href={`#/${r}`} className={r === actual ? "activo" : ""}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONOS[r]} /></svg>
            <span>{NOMBRES[r]}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
