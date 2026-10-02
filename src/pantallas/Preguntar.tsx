import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { supabase, type Miembro } from "../supabase";
import { useDatos } from "../lib/datos";
import { hace } from "../lib/formato";
import { Falla, Md, Seccion, Vacio } from "../ui";

type Turno = { rol: "usuario" | "asistente"; texto: string; consultas?: number };

const SUGERENCIAS = [
  "¿Cuántas ventas hicimos en Robledo por año?",
  "¿Cómo vamos contra la meta de este mes?",
  "¿Qué publicaciones funcionaron mejor?",
  "¿Qué dice la estrategia de los barrios foco?",
  "¿Qué tareas están pendientes?",
];

// La conversación vive mientras la pestaña esté abierta, para no perderla al cambiar de pantalla.
const CLAVE = "santafe-preguntar";
function leerConversacion(): Turno[] {
  try { return JSON.parse(sessionStorage.getItem(CLAVE) ?? "[]") as Turno[]; } catch { return []; }
}

export default function Preguntar({ miembro }: { miembro: Miembro }) {
  const [turnos, setTurnos] = useState<Turno[]>(leerConversacion);
  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem(CLAVE, JSON.stringify(turnos)); } catch { /* sin almacenamiento */ }
  }, [turnos]);
  useEffect(() => { if (turnos.length) fin.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turnos.length, enviando]);

  async function preguntar(texto: string) {
    const q = texto.trim();
    if (!q || enviando) return;
    setError(null);
    setEnviando(true);
    const historial = turnos.map(({ rol, texto }) => ({ rol, texto }));
    setTurnos((t) => [...t, { rol: "usuario", texto: q }]);
    setPregunta("");
    const { data, error } = await supabase.functions.invoke("preguntar", { body: { pregunta: q, historial } });
    let msg = data?.error as string | undefined;
    if (error && !msg) {
      const ctx = (error as { context?: Response }).context;
      msg = (await ctx?.json?.().catch(() => null))?.error ?? error.message;
    }
    if (msg || !data?.respuesta) {
      setError(msg ?? "No llegó respuesta. Intenta de nuevo.");
      setTurnos((t) => t.slice(0, -1));
      setPregunta(q);
    } else {
      setTurnos((t) => [...t, { rol: "asistente", texto: data.respuesta as string, consultas: data.consultas as number }]);
    }
    setEnviando(false);
  }

  function enviar(e: FormEvent) { e.preventDefault(); preguntar(pregunta); }
  function teclas(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); preguntar(pregunta); }
  }

  return (
    <>
      <div className="titular">
        <p className="sobre">Datos y estrategia de SantaFe</p>
        <h1>Pregúntale a SantaFe</h1>
        <p className="sub">
          Pregunta lo que necesites sobre ventas, avalúos, pauta, leads, contenido, tareas o la estrategia.
          Responde con los datos de la app y los documentos del equipo, y al final dice de dónde sacó la información.
        </p>
      </div>

      <div className="chat">
        {turnos.length === 0 && (
          <div className="sugerencias">
            <p className="etq">Prueba con una de estas:</p>
            <div className="sugerencias-lista">
              {SUGERENCIAS.map((s) => (
                <button key={s} className="chip" onClick={() => preguntar(s)} disabled={enviando}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {turnos.map((t, i) => (
          <div key={i} className={`burbuja ${t.rol}`}>
            {t.rol === "usuario" ? <p>{t.texto}</p> : <Md texto={t.texto} />}
          </div>
        ))}

        {enviando && (
          <div className="burbuja asistente pensando">
            <span className="puntitos" aria-hidden="true"><i /><i /><i /></span>
            Buscando en los datos… (puede tardar un minuto)
          </div>
        )}
        <Falla error={error} />
        <div ref={fin} />

        <form className="caja-pregunta" onSubmit={enviar}>
          <textarea
            rows={2} value={pregunta} maxLength={4000} placeholder="Escribe tu pregunta…"
            onChange={(e) => setPregunta(e.target.value)} onKeyDown={teclas} aria-label="Tu pregunta"
          />
          <button className="boton" type="submit" disabled={enviando || !pregunta.trim()}>Preguntar</button>
        </form>
        {turnos.length > 0 && (
          <div className="botones">
            <button className="enlace" onClick={() => { setTurnos([]); setError(null); }} disabled={enviando}>Empezar otra conversación</button>
            <span className="sub">Las cifras salen de la base de datos; si algo no cuadra, avísale a Laura.</span>
          </div>
        )}
      </div>

      {miembro.rol === "admin" && <Fuentes />}
    </>
  );
}

// ---------- Fuentes (solo administradora) ----------

type Fuente = { id: string; titulo: string; tema: string; resumen: string | null; fuente: string | null; actualizado: string };
type Borrador = { id: string | null; titulo: string; tema: string; resumen: string; fuente: string; contenido: string };

const TEMAS = ["estrategia", "contenido", "pauta", "ventas", "mercado", "operacion", "bitacora", "otro"];
const VACIO: Borrador = { id: null, titulo: "", tema: "estrategia", resumen: "", fuente: "", contenido: "" };

function hacerId(titulo: string, usados: string[]) {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "fuente";
  let id = base;
  for (let n = 2; usados.includes(id); n++) id = `${base}-${n}`;
  return id;
}

function Fuentes() {
  const { datos, error, recargar } = useDatos<Fuente[]>(
    () => supabase.from("conocimiento").select("id,titulo,tema,resumen,fuente,actualizado").order("tema").order("titulo"),
  );
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);
  const lista = datos ?? [];

  async function editar(f: Fuente) {
    setFalla(null);
    const { data, error } = await supabase.from("conocimiento").select("contenido").eq("id", f.id).single();
    if (error) { setFalla(error.message); return; }
    setBorrador({ id: f.id, titulo: f.titulo, tema: f.tema, resumen: f.resumen ?? "", fuente: f.fuente ?? "", contenido: data.contenido as string });
  }

  function leerArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo || !borrador) return;
    const lector = new FileReader();
    lector.onload = () => setBorrador((b) => b && ({
      ...b,
      contenido: String(lector.result ?? ""),
      titulo: b.titulo || archivo.name.replace(/\.[^.]+$/, ""),
      fuente: b.fuente || archivo.name,
    }));
    lector.readAsText(archivo);
    e.target.value = "";
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!borrador) return;
    setGuardando(true);
    setFalla(null);
    const fila = {
      titulo: borrador.titulo.trim(), tema: borrador.tema, contenido: borrador.contenido,
      resumen: borrador.resumen.trim() || null, fuente: borrador.fuente.trim() || null,
    };
    const { error } = borrador.id
      ? await supabase.from("conocimiento").update(fila).eq("id", borrador.id)
      : await supabase.from("conocimiento").insert({ ...fila, id: hacerId(fila.titulo, lista.map((f) => f.id)) });
    setGuardando(false);
    if (error) { setFalla(error.message); return; }
    setBorrador(null);
    recargar();
  }

  const listo = borrador && borrador.titulo.trim() && borrador.contenido.trim();

  return (
    <Seccion
      titulo="Fuentes que consulta"
      sub="Solo tú ves esta parte. Agrega aquí documentos nuevos (estrategia, informes, bitácoras) para que el asistente los tenga en cuenta. Las cifras de ventas, pauta, leads y tareas las lee directo de la app."
      accion={!borrador && <button className="boton peq" onClick={() => { setFalla(null); setBorrador({ ...VACIO }); }}>Agregar fuente</button>}
    >
      <Falla error={error ?? falla} />

      {borrador && (
        <form className="tarjeta fuente-form" onSubmit={guardar}>
          <h3>{borrador.id ? "Editar fuente" : "Nueva fuente"}</h3>
          <div className="fila-campos">
            <label>Tema
              <select value={borrador.tema} onChange={(e) => setBorrador({ ...borrador, tema: e.target.value })}>
                {TEMAS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>Título
              <input value={borrador.titulo} maxLength={200} required onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })} />
            </label>
          </div>
          <label>De qué trata (una o dos frases; con esto el asistente decide si leerlo)
            <input value={borrador.resumen} maxLength={500} onChange={(e) => setBorrador({ ...borrador, resumen: e.target.value })} />
          </label>
          <label>De dónde sale (opcional)
            <input value={borrador.fuente} maxLength={300} placeholder="Ej.: informe de Cesar, sep 2026" onChange={(e) => setBorrador({ ...borrador, fuente: e.target.value })} />
          </label>
          <label className="editor">Contenido: pega el texto o sube un archivo .md, .txt o .csv
            <textarea rows={12} value={borrador.contenido} maxLength={400000} required onChange={(e) => setBorrador({ ...borrador, contenido: e.target.value })} />
          </label>
          <div className="botones">
            <label className="boton secundario peq subir">
              Subir archivo
              <input type="file" accept=".md,.txt,.csv,text/plain,text/markdown,text/csv" onChange={leerArchivo} />
            </label>
            <span className="sub">{borrador.contenido.length.toLocaleString("es-CO")} caracteres</span>
          </div>
          <div className="botones">
            <button className="boton" type="submit" disabled={guardando || !listo}>{guardando ? "Guardando…" : "Guardar"}</button>
            <button className="boton secundario" type="button" onClick={() => setBorrador(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {lista.length === 0 ? (
        <Vacio>Todavía no hay fuentes.</Vacio>
      ) : (
        <div className="lista">
          {lista.map((f) => (
            <div key={f.id} className="fila">
              <span className="tema-fuente">{f.tema}</span>
              <div className="crece">
                <b>{f.titulo}</b>
                {f.resumen && <div className="sub">{f.resumen}</div>}
                <div className="sub">Actualizado {hace(f.actualizado)}</div>
              </div>
              <button className="enlace" onClick={() => editar(f)}>Editar</button>
            </div>
          ))}
        </div>
      )}
    </Seccion>
  );
}
