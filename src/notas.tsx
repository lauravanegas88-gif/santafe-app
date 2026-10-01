import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { supabase, type Miembro } from "./supabase";
import { hace } from "./lib/formato";

// Notas del equipo. Se cargan una vez para toda la app y cada parte filtra las suyas por `contexto`.
// Si el texto lleva @correo de alguien del equipo, la base le manda un correo (función avisar-menciones).

export type Ruta = "hoy" | "estrategia" | "contenido" | "pauta" | "leads" | "notas";
export type Nota = {
  id: string; creado: string; autor_email: string; texto: string; contexto: string;
  contexto_titulo: string | null; ruta: Ruta; menciones: string[]; avisados: string[] | null; aviso_error: string | null;
};
type Persona = { email: string; nombre: string | null };

type Ctx = {
  notas: Nota[]; equipo: Persona[]; yo: Miembro; error: string | null;
  recargar: () => Promise<void>;
  publicar: (n: { texto: string; contexto: string; contexto_titulo: string; ruta: Ruta }) => Promise<string | null>;
  borrar: (id: string) => Promise<void>;
};
const NotasCtx = createContext<Ctx | null>(null);

export function useNotas() {
  const c = useContext(NotasCtx);
  if (!c) throw new Error("useNotas fuera de NotasProvider");
  return c;
}

export function NotasProvider({ yo, children }: { yo: Miembro; children: ReactNode }) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [equipo, setEquipo] = useState<Persona[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const [n, e] = await Promise.all([
      supabase.from("comentarios").select("*").order("creado", { ascending: false }).limit(1000),
      supabase.from("equipo").select("email,nombre").order("nombre"),
    ]);
    if (n.data) setNotas(n.data as Nota[]);
    if (e.data) setEquipo(e.data as Persona[]);
    setError(n.error?.message ?? e.error?.message ?? null);
  }, []);

  useEffect(() => {
    recargar();
    const cada = setInterval(recargar, 60_000);
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(cada); document.removeEventListener("visibilitychange", alVolver); };
  }, [recargar]);

  const publicar: Ctx["publicar"] = async (n) => {
    // Autor, fecha y menciones los pone la base; aquí solo se envía el texto y dónde va.
    const { error } = await supabase.from("comentarios").insert({ ...n, autor_email: yo.email });
    if (error) return error.message;
    await recargar();
    // El correo sale en segundos: se vuelve a leer para mostrar si llegó.
    setTimeout(recargar, 6000);
    return null;
  };

  const borrar = async (id: string) => {
    await supabase.from("comentarios").delete().eq("id", id);
    await recargar();
  };

  return <NotasCtx.Provider value={{ notas, equipo, yo, error, recargar, publicar, borrar }}>{children}</NotasCtx.Provider>;
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const RE_MENCION = /@([^\s@]+@[^\s@]+\.[a-z]{2,})/gi;

// Correos del equipo mencionados en un texto (la misma regla que usa la base).
export function mencionados(texto: string, equipo: Persona[], yo: string) {
  const t = texto.toLowerCase();
  return equipo.filter((p) => p.email !== yo && t.includes("@" + p.email));
}

const nombreDe = (equipo: Persona[], email: string) => equipo.find((p) => p.email === email)?.nombre ?? email;

// Texto de la nota con las menciones resaltadas y con el nombre en vez del correo.
function TextoNota({ texto, equipo }: { texto: string; equipo: Persona[] }) {
  const partes: ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(RE_MENCION)) {
    const email = m[1].toLowerCase();
    const p = equipo.find((x) => x.email === email);
    if (!p) continue;
    partes.push(texto.slice(ultimo, m.index));
    partes.push(<span key={m.index} className="mencion" title={p.email}>@{p.nombre ?? p.email}</span>);
    ultimo = (m.index ?? 0) + m[0].length;
  }
  partes.push(texto.slice(ultimo));
  return <p className="nota-texto">{partes}</p>;
}

export function TarjetaNota({ n, conContexto = false }: { n: Nota; conContexto?: boolean }) {
  const { equipo, yo, borrar } = useNotas();
  const puedeBorrar = n.autor_email === yo.email || yo.rol === "admin";
  let aviso: ReactNode = null;
  if (n.menciones.length) {
    const quienes = n.menciones.map((e) => nombreDe(equipo, e).split(" ")[0]).join(", ");
    if (n.avisados?.length) aviso = <span className="ok">✓ Correo enviado a {n.avisados.map((e) => nombreDe(equipo, e).split(" ")[0]).join(", ")}</span>;
    else if (n.aviso_error) aviso = <span className="error-peq">No se pudo enviar el correo a {quienes}. Lo verán aquí, en Notas.</span>;
    else aviso = <span>Enviando correo a {quienes}…</span>;
  }
  return (
    <div className="nota">
      <div className="nota-cab">
        <b>{nombreDe(equipo, n.autor_email)}</b>
        <span className="sub">{hace(n.creado)}</span>
        {conContexto && n.contexto_titulo && <a className="insignia sin-mayus" href={`#/${n.ruta}`}>{n.contexto_titulo}</a>}
        {puedeBorrar && (
          <button className="enlace peligro nota-borrar" onClick={() => confirm("¿Borrar esta nota?") && borrar(n.id)}>Borrar</button>
        )}
      </div>
      <TextoNota texto={n.texto} equipo={equipo} />
      {aviso && <div className="sub nota-aviso">{aviso}</div>}
    </div>
  );
}

// Caja para escribir con sugerencias al teclear @.
export function Escribir({ contexto, titulo, ruta, alPublicar, enfocar = false }: {
  contexto: string; titulo: string; ruta: Ruta; alPublicar?: () => void; enfocar?: boolean;
}) {
  const { equipo, yo, publicar } = useNotas();
  const [texto, setTexto] = useState("");
  const [sug, setSug] = useState<{ desde: number; q: string } | null>(null);
  const [i, setI] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (enfocar) ref.current?.focus(); }, [enfocar]);

  const opciones = useMemo(() => {
    if (!sug) return [];
    const q = sinTildes(sug.q);
    return equipo.filter((p) => p.email !== yo.email && (p.email.includes(q) || sinTildes(p.nombre ?? "").includes(q))).slice(0, 6);
  }, [sug, equipo, yo.email]);

  function leer(t: string, pos: number) {
    const m = t.slice(0, pos).match(/(^|\s)@([^\s@]*)$/);
    setSug(m ? { desde: pos - m[2].length - 1, q: m[2] } : null);
    setI(0);
  }

  function elegir(p: Persona) {
    if (!sug || !ref.current) return;
    const pos = ref.current.selectionStart;
    const nuevo = texto.slice(0, sug.desde) + "@" + p.email + " " + texto.slice(pos);
    const cursor = sug.desde + p.email.length + 2;
    setTexto(nuevo);
    setSug(null);
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(cursor, cursor); });
  }

  function arroba() {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart;
    const antes = texto.slice(0, pos);
    const agregado = (antes && !/\s$/.test(antes) ? " " : "") + "@";
    const nuevo = antes + agregado + texto.slice(pos);
    setTexto(nuevo);
    const cursor = pos + agregado.length;
    setSug({ desde: cursor - 1, q: "" });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(cursor, cursor); });
  }

  function tecla(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (opciones.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setI((i + 1) % opciones.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setI((i - 1 + opciones.length) % opciones.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); elegir(opciones[i]); return; }
      if (e.key === "Escape") { setSug(null); return; }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); enviar(); }
  }

  async function enviar() {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    setFalla(null);
    const err = await publicar({ texto: texto.trim(), contexto, contexto_titulo: titulo, ruta });
    setEnviando(false);
    if (err) return setFalla(err);
    setTexto("");
    alPublicar?.();
  }

  const avisar = mencionados(texto, equipo, yo.email);

  return (
    <div className="escribir">
      <div className="escribir-caja">
        <textarea ref={ref} rows={2} value={texto} placeholder="Escribe una nota. Usa @ para avisarle a alguien por correo."
          onChange={(e) => { setTexto(e.target.value); leer(e.target.value, e.target.selectionStart); }}
          onClick={(e) => leer(texto, e.currentTarget.selectionStart)}
          onKeyDown={tecla} onBlur={() => setTimeout(() => setSug(null), 150)} />
        {opciones.length > 0 && (
          <ul className="sugerencias" role="listbox">
            {opciones.map((p, j) => (
              <li key={p.email} role="option" aria-selected={j === i} className={j === i ? "activa" : ""}
                onMouseDown={(e) => { e.preventDefault(); elegir(p); }}>
                <b>{p.nombre ?? p.email}</b> <span className="sub">{p.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {falla && <p className="falla">{falla}</p>}
      <div className="escribir-pie">
        <button type="button" className="boton peq secundario" onClick={arroba} title="Mencionar a alguien">@ Mencionar</button>
        <span className="sub crece">{avisar.length ? `Le llegará un correo a ${avisar.map((p) => (p.nombre ?? p.email).split(" ")[0]).join(", ")}` : ""}</span>
        <button type="button" className="boton peq" disabled={!texto.trim() || enviando} onClick={enviar}>{enviando ? "Guardando…" : "Publicar"}</button>
      </div>
    </div>
  );
}

// Hilo de notas de una parte de la app. Cerrado muestra solo el botón con el número de notas.
export function Notas({ contexto, titulo, ruta, abierto = false }: { contexto: string; titulo: string; ruta: Ruta; abierto?: boolean }) {
  const { notas } = useNotas();
  const mias = notas.filter((n) => n.contexto === contexto);
  const [ver, setVer] = useState(abierto);
  const [escribiendo, setEscribiendo] = useState(false);

  if (!ver) {
    return (
      <button className="enlace boton-notas" onClick={() => { setVer(true); setEscribiendo(mias.length === 0); }}>
        💬 {mias.length ? `${mias.length} ${mias.length === 1 ? "nota" : "notas"}` : "Agregar nota"}
      </button>
    );
  }
  return (
    <div className="hilo">
      {[...mias].reverse().map((n) => <TarjetaNota key={n.id} n={n} />)}
      <Escribir contexto={contexto} titulo={titulo} ruta={ruta} enfocar={escribiendo} />
      {!abierto && <button className="enlace sub" onClick={() => setVer(false)}>Ocultar notas</button>}
    </div>
  );
}

// Cuántas veces me mencionaron desde la última vez que abrí Notas (se guarda solo en este navegador).
const CLAVE_VISTO = "santafe-notas-visto";
export function leerVisto() {
  try { return localStorage.getItem(CLAVE_VISTO) ?? ""; } catch { return ""; }
}
export function marcarVisto() {
  try { localStorage.setItem(CLAVE_VISTO, new Date().toISOString()); } catch { /* sin almacenamiento */ }
}
