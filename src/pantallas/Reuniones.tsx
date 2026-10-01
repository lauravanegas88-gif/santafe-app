import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../supabase";
import { capital, dia, hace } from "../lib/formato";
import { Avatar, Cargando, Chips, Falla, Vacio } from "../ui";
import { Notas, useNotas } from "../notas";

// Reuniones y las tareas que salen de ellas. Cada tarea tiene responsable, estado,
// para cuándo estaría lista y sus notas (las mismas notas de la app, con @ y correo).

export type Estado = "sin_empezar" | "iniciado" | "terminado" | "bloqueado";
export const ESTADOS: { valor: Estado; texto: string; icono: string }[] = [
  { valor: "sin_empezar", texto: "Sin empezar", icono: "🌱" },
  { valor: "iniciado", texto: "Iniciado", icono: "🚀" },
  { valor: "terminado", texto: "Terminado", icono: "✅" },
  { valor: "bloqueado", texto: "Bloqueo de avance", icono: "🧱" },
];
const ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.valor, e])) as Record<Estado, (typeof ESTADOS)[number]>;

type Reunion = { id: string; fecha: string; titulo: string; acuerdos: string | null; creado_por: string | null };
export type Tarea = {
  id: string; reunion_id: string | null; titulo: string; responsable: string | null; estado: Estado;
  para_cuando: string | null; creado: string; creado_por: string | null; estado_cambio: string; estado_por: string | null;
};
type Borrador = { titulo: string; responsable: string; para_cuando: string };
const VACIA: Borrador = { titulo: "", responsable: "", para_cuando: "" };

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const vencida = (t: Tarea) => t.estado !== "terminado" && !!t.para_cuando && t.para_cuando < hoyISO();

// Primero lo que frena, luego lo vencido y lo más próximo; lo terminado al final.
const PESO: Record<Estado, number> = { bloqueado: 0, iniciado: 1, sin_empezar: 2, terminado: 3 };
const ordenar = (a: Tarea, b: Tarea) =>
  PESO[a.estado] - PESO[b.estado] || (a.para_cuando ?? "9999").localeCompare(b.para_cuando ?? "9999") || a.creado.localeCompare(b.creado);

// Datos del tablero: reuniones y tareas, con cambios que se ven al instante.
function useTablero() {
  const notas = useNotas();
  const [reuniones, setReuniones] = useState<Reunion[] | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const [r, t] = await Promise.all([
      supabase.from("reuniones").select("id,fecha,titulo,acuerdos,creado_por")
        .order("fecha", { ascending: false }).order("creado", { ascending: false }).limit(300),
      supabase.from("tareas").select("*").order("creado").limit(2000),
    ]);
    if (r.data) setReuniones(r.data as Reunion[]);
    if (t.data) setTareas(t.data as Tarea[]);
    setError(r.error?.message ?? t.error?.message ?? null);
  }, []);

  useEffect(() => {
    recargar();
    const cada = setInterval(recargar, 60_000);
    return () => clearInterval(cada);
  }, [recargar]);

  async function cambiar(id: string, cambios: Partial<Tarea>) {
    setTareas((ts) => ts.map((t) => (t.id === id ? { ...t, ...cambios } : t)));
    const { error } = await supabase.from("tareas").update(cambios).eq("id", id);
    if (error) setError(error.message);
    await recargar();
    if ("responsable" in cambios) notas.recargar();
  }

  async function crear(lista: (Borrador & { reunion_id: string | null })[]) {
    const filas = lista.filter((b) => b.titulo.trim()).map((b) => ({
      reunion_id: b.reunion_id, titulo: b.titulo.trim(), responsable: b.responsable || null, para_cuando: b.para_cuando || null,
    }));
    if (!filas.length) return null;
    const { error } = await supabase.from("tareas").insert(filas);
    await recargar();
    notas.recargar(); // la asignación deja una nota con @ (y el correo)
    return error?.message ?? null;
  }

  async function borrarTarea(id: string) {
    setTareas((ts) => ts.filter((t) => t.id !== id));
    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) setError(error.message);
    await recargar();
  }

  async function borrarReunion(id: string) {
    const { error } = await supabase.from("reuniones").delete().eq("id", id);
    if (error) setError(error.message);
    await recargar();
  }

  return { reuniones, tareas, error, recargar, cambiar, crear, borrarTarea, borrarReunion };
}
type Tablero = ReturnType<typeof useTablero>;

/* ---------- Piezas ---------- */

function SelectorEstado({ valor, cambiar }: { valor: Estado; cambiar: (e: Estado) => void }) {
  return (
    <label className={`estado est-${valor}`}>
      <span aria-hidden="true">{ESTADO[valor].icono}</span>
      <select value={valor} onChange={(e) => cambiar(e.target.value as Estado)} aria-label="Estado de la tarea">
        {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
      </select>
    </label>
  );
}

function Fecha({ t }: { t: Tarea }) {
  if (!t.para_cuando) return <span className="fecha sin">Sin fecha</span>;
  const hoy = hoyISO();
  const manana = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA");
  if (vencida(t)) return <span className="fecha tarde" title="Ya pasó la fecha">⏰ Era para el {dia(t.para_cuando)}</span>;
  if (t.estado === "terminado") return <span className="fecha sin">Para el {dia(t.para_cuando)}</span>;
  if (t.para_cuando === hoy) return <span className="fecha pronto">📌 Para hoy</span>;
  if (t.para_cuando === manana) return <span className="fecha pronto">📌 Para mañana</span>;
  return <span className="fecha">🗓 Para el {dia(t.para_cuando)}</span>;
}

function CamposTarea({ b, cambiar, autoFocus = false }: { b: Borrador; cambiar: (b: Borrador) => void; autoFocus?: boolean }) {
  const { equipo } = useNotas();
  return (
    <div className="campos-tarea">
      <input className="campo-titulo" value={b.titulo} autoFocus={autoFocus} maxLength={300}
        placeholder="¿Qué hay que hacer?" onChange={(e) => cambiar({ ...b, titulo: e.target.value })} />
      <select value={b.responsable} onChange={(e) => cambiar({ ...b, responsable: e.target.value })} aria-label="Responsable">
        <option value="">¿Quién?</option>
        {equipo.map((p) => <option key={p.email} value={p.email}>{p.nombre ?? p.email}</option>)}
      </select>
      <input type="date" value={b.para_cuando} onChange={(e) => cambiar({ ...b, para_cuando: e.target.value })} aria-label="Para cuándo" title="Para cuándo" />
    </div>
  );
}

function FormTarea({ inicial = VACIA, texto, alGuardar, alCancelar }: {
  inicial?: Borrador; texto: string; alGuardar: (b: Borrador) => Promise<string | null>; alCancelar: () => void;
}) {
  const [b, setB] = useState(inicial);
  const [falla, setFalla] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!b.titulo.trim()) return;
    setGuardando(true);
    const err = await alGuardar(b);
    setGuardando(false);
    if (err) setFalla(err);
  }
  return (
    <form className="form-tarea" onSubmit={enviar}>
      <CamposTarea b={b} cambiar={setB} autoFocus />
      {falla && <p className="falla">{falla}</p>}
      <div className="botones">
        <button className="boton peq" disabled={!b.titulo.trim() || guardando}>{guardando ? "Guardando…" : texto}</button>
        <button type="button" className="boton peq secundario" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function TarjetaTarea({ t, tablero, reunion, verPersona = true, verReunion = false }: {
  t: Tarea; tablero: Tablero; reunion?: Reunion; verPersona?: boolean; verReunion?: boolean;
}) {
  const { equipo, yo } = useNotas();
  const [editando, setEditando] = useState(false);
  const [abrir, setAbrir] = useState(0); // al pasar a "bloqueo" se abre la nota para contar qué pasa
  const nombre = (e: string | null) => (e ? equipo.find((p) => p.email === e)?.nombre ?? e : null);
  const primer = (e: string | null) => nombre(e)?.split(" ")[0];
  const puedeBorrar = t.creado_por === yo.email || yo.rol === "admin";

  return (
    <article className={`tarea est-${t.estado}${vencida(t) ? " vencida" : ""}`}>
      <div className="tarea-cab">
        <SelectorEstado valor={t.estado} cambiar={(e) => { tablero.cambiar(t.id, { estado: e }); if (e === "bloqueado") setAbrir((n) => n + 1); }} />
        <Fecha t={t} />
        <span className="tarea-acciones">
          <button className="icono" onClick={() => setEditando(!editando)} title="Editar" aria-label="Editar tarea">✏️</button>
          {puedeBorrar && (
            <button className="icono" title="Borrar" aria-label="Borrar tarea"
              onClick={() => confirm(`¿Borrar la tarea «${t.titulo}»?`) && tablero.borrarTarea(t.id)}>🗑</button>
          )}
        </span>
      </div>

      {editando ? (
        <FormTarea texto="Guardar" inicial={{ titulo: t.titulo, responsable: t.responsable ?? "", para_cuando: t.para_cuando ?? "" }}
          alCancelar={() => setEditando(false)}
          alGuardar={async (b) => {
            setEditando(false);
            await tablero.cambiar(t.id, { titulo: b.titulo.trim(), responsable: b.responsable || null, para_cuando: b.para_cuando || null });
            return null;
          }} />
      ) : (
        <h3 className="tarea-titulo">{t.titulo}</h3>
      )}

      <div className="tarea-meta">
        {verPersona && (
          <span className="persona-chip"><Avatar email={t.responsable} nombre={nombre(t.responsable)} peq />{nombre(t.responsable) ?? "Sin responsable"}</span>
        )}
        {verReunion && reunion && <span>📅 {reunion.titulo} · {dia(reunion.fecha)}</span>}
        <span>{ESTADO[t.estado].texto}{t.estado_por ? ` por ${primer(t.estado_por)}` : ""} {hace(t.estado_cambio)}</span>
      </div>

      {t.estado === "bloqueado" && <p className="tarea-aviso">🧱 Cuenta en una nota qué la frena y quién puede ayudar.</p>}

      <Notas key={abrir} contexto={`tarea:${t.id}`} titulo={`Tarea · ${t.titulo}`} ruta="reuniones"
        abierto={abrir > 0} enfocar={abrir > 0} texto="Dejar nota de avance"
        pista="¿Cómo va? ¿Qué falta y para cuándo estaría lista? Usa @ para avisarle a alguien." />
    </article>
  );
}

/* ---------- Nueva reunión ---------- */

function NuevaReunion({ tablero, alTerminar }: { tablero: Tablero; alTerminar: () => void }) {
  const [fecha, setFecha] = useState(hoyISO());
  const [titulo, setTitulo] = useState("");
  const [acuerdos, setAcuerdos] = useState("");
  const [lista, setLista] = useState<Borrador[]>([VACIA, VACIA]);
  const [falla, setFalla] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setFalla(null);
    const { data, error } = await supabase.from("reuniones")
      .insert({ fecha, titulo: titulo.trim(), acuerdos: acuerdos.trim() || null }).select("id").single();
    if (error || !data) { setGuardando(false); return setFalla(error?.message ?? "No se pudo guardar"); }
    const err = await tablero.crear(lista.map((b) => ({ ...b, reunion_id: data.id as string })));
    setGuardando(false);
    if (err) return setFalla(`La reunión quedó guardada, pero no las tareas: ${err}`);
    alTerminar();
  }

  return (
    <form className="tarjeta nueva-reunion" onSubmit={guardar}>
      <h2>✨ Nueva reunión</h2>
      <div className="fila-campos">
        <label>Fecha<input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <label className="crece">De qué fue<input required maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Reunión semanal de contenido" /></label>
      </div>
      <label>Lo que se habló y se acordó
        <textarea rows={3} value={acuerdos} onChange={(e) => setAcuerdos(e.target.value)} placeholder="Ideas, decisiones y lo que quedó pendiente…" />
      </label>
      <div>
        <div className="etq">Tareas que salieron</div>
        <div className="lista-borradores">
          {lista.map((b, i) => (
            <div key={i} className="borrador">
              <span className="num-borrador">{i + 1}</span>
              <CamposTarea b={b} cambiar={(nb) => setLista(lista.map((x, j) => (j === i ? nb : x)))} />
              {lista.length > 1 && (
                <button type="button" className="icono" aria-label="Quitar" onClick={() => setLista(lista.filter((_, j) => j !== i))}>✕</button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="enlace" onClick={() => setLista([...lista, VACIA])}>+ Otra tarea</button>
      </div>
      {falla && <p className="falla">{falla}</p>}
      <div className="botones">
        <button className="boton" disabled={!titulo.trim() || guardando}>{guardando ? "Guardando…" : "Guardar reunión"}</button>
        <button type="button" className="boton secundario" onClick={alTerminar}>Cancelar</button>
      </div>
      <p className="sub">A cada responsable le queda una nota con su @ (y le llega un correo cuando esté activo el envío).</p>
    </form>
  );
}

/* ---------- Vistas ---------- */

type Filtro = "pendientes" | "todas" | Estado;
type Vista = "persona" | "reunion";

function PorPersona({ tareas, tablero, reuniones, soloMias }: { tareas: Tarea[]; tablero: Tablero; reuniones: Reunion[]; soloMias: boolean }) {
  const { equipo, yo } = useNotas();
  const [agregando, setAgregando] = useState<string | null>(null);
  const gente = [
    ...equipo.filter((p) => p.email === yo.email),
    ...(soloMias ? [] : equipo.filter((p) => p.email !== yo.email)),
  ];
  const sinNadie = tareas.filter((t) => !t.responsable);
  const reunion = (id: string | null) => reuniones.find((r) => r.id === id);

  return (
    <div className="tablero">
      {gente.map((p) => {
        const suyas = tareas.filter((t) => t.responsable === p.email).sort(ordenar);
        const bloqueos = suyas.filter((t) => t.estado === "bloqueado").length;
        return (
          <section key={p.email} className="columna">
            <header className="columna-cab">
              <Avatar email={p.email} nombre={p.nombre} />
              <div className="crece">
                <b>{p.email === yo.email ? `${(p.nombre ?? "Tú").split(" ")[0]} (tú)` : p.nombre ?? p.email}</b>
                <div className="sub">{suyas.length} {suyas.length === 1 ? "tarea" : "tareas"}{bloqueos ? ` · ${bloqueos} con bloqueo` : ""}</div>
              </div>
              <button className="icono mas" title="Agregar tarea" aria-label={`Agregar tarea a ${p.nombre ?? p.email}`}
                onClick={() => setAgregando(agregando === p.email ? null : p.email)}>＋</button>
            </header>
            {agregando === p.email && (
              <FormTarea texto="Agregar" inicial={{ ...VACIA, responsable: p.email }} alCancelar={() => setAgregando(null)}
                alGuardar={async (b) => { const e = await tablero.crear([{ ...b, reunion_id: null }]); if (!e) setAgregando(null); return e; }} />
            )}
            {suyas.length === 0 ? <p className="nada">Nada por aquí 🎉</p> :
              suyas.map((t) => <TarjetaTarea key={t.id} t={t} tablero={tablero} reunion={reunion(t.reunion_id)} verPersona={false} verReunion />)}
          </section>
        );
      })}
      {!soloMias && sinNadie.length > 0 && (
        <section className="columna">
          <header className="columna-cab">
            <Avatar email={null} />
            <div className="crece"><b>Sin responsable</b><div className="sub">Asígnalas con ✏️</div></div>
          </header>
          {sinNadie.sort(ordenar).map((t) => <TarjetaTarea key={t.id} t={t} tablero={tablero} reunion={reunion(t.reunion_id)} verPersona={false} verReunion />)}
        </section>
      )}
    </div>
  );
}

function TarjetaReunion({ r, tareas, todas, tablero }: { r: Reunion | null; tareas: Tarea[]; todas: Tarea[]; tablero: Tablero }) {
  const { yo } = useNotas();
  const [agregando, setAgregando] = useState(false);
  const [verAcuerdos, setVerAcuerdos] = useState(false);
  const hechas = todas.filter((t) => t.estado === "terminado").length;
  const d = r ? new Date(r.fecha + "T00:00:00") : null;

  return (
    <article className="tarjeta reunion">
      <header className="reunion-cab">
        {d ? (
          <div className="calendario" aria-hidden="true">
            <span>{d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}</span>
            <b>{d.getDate()}</b>
          </div>
        ) : <div className="calendario suelta" aria-hidden="true"><b>📎</b></div>}
        <div className="crece">
          <h2>{r ? r.titulo : "Tareas sin reunión"}</h2>
          <div className="sub">
            {r && capital(new Date(r.fecha + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }))}
            {todas.length > 0 && ` · ${hechas} de ${todas.length} terminadas`}
          </div>
        </div>
        {r && (r.creado_por === yo.email || yo.rol === "admin") && (
          <button className="icono" title="Borrar reunión" aria-label="Borrar reunión"
            onClick={() => confirm(`¿Borrar la reunión «${r.titulo}»? Sus tareas se conservan.`) && tablero.borrarReunion(r.id)}>🗑</button>
        )}
      </header>
      {todas.length > 0 && (
        <div className="progreso"><span style={{ width: `${(hechas / todas.length) * 100}%` }} /></div>
      )}
      {r?.acuerdos && (
        <div className={`acuerdos${verAcuerdos ? " abierto" : ""}`}>
          <p>{r.acuerdos}</p>
          {r.acuerdos.length > 220 && <button className="enlace" onClick={() => setVerAcuerdos(!verAcuerdos)}>{verAcuerdos ? "Ver menos" : "Ver todo"}</button>}
        </div>
      )}
      <div className="tareas">
        {tareas.length === 0 && todas.length > 0 && <p className="nada">Nada en este filtro.</p>}
        {[...tareas].sort(ordenar).map((t) => <TarjetaTarea key={t.id} t={t} tablero={tablero} />)}
      </div>
      {r && (agregando ? (
        <FormTarea texto="Agregar" alCancelar={() => setAgregando(false)}
          alGuardar={async (b) => { const e = await tablero.crear([{ ...b, reunion_id: r.id }]); if (!e) setAgregando(false); return e; }} />
      ) : (
        <div className="reunion-pie">
          <button className="enlace" onClick={() => setAgregando(true)}>+ Agregar tarea</button>
          <Notas contexto={`reunion:${r.id}`} titulo={`Reunión · ${r.titulo}`} ruta="reuniones" texto="Notas de la reunión" />
        </div>
      ))}
    </article>
  );
}

/* ---------- Pantalla ---------- */

export default function Reuniones() {
  const tablero = useTablero();
  const { yo } = useNotas();
  const [vista, setVista] = useState<Vista>("persona");
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [soloMias, setSoloMias] = useState(false);
  const [nueva, setNueva] = useState(false);

  const { reuniones, tareas } = tablero;
  const conteo = useMemo(() => {
    const c = { sin_empezar: 0, iniciado: 0, terminado: 0, bloqueado: 0 } as Record<Estado, number>;
    for (const t of tareas) if (!soloMias || t.responsable === yo.email) c[t.estado]++;
    return c;
  }, [tareas, soloMias, yo.email]);

  if (!reuniones) return tablero.error ? <Falla error={tablero.error} /> : <Cargando />;

  const pasa = (t: Tarea) =>
    (!soloMias || t.responsable === yo.email) &&
    (filtro === "todas" || (filtro === "pendientes" ? t.estado !== "terminado" : t.estado === filtro));
  const visibles = tareas.filter(pasa);
  const sueltas = tareas.filter((t) => !t.reunion_id);

  return (
    <>
      <div className="titular">
        <p className="sobre">Lo que acordamos</p>
        <h1>Reuniones <span className="garabato">y tareas</span></h1>
        <p className="sub">Cada tarea con su responsable, cómo va y para cuándo estaría. Cambia el estado en la cajita de color y deja notas de avance.</p>
      </div>

      <div className="estados-resumen">
        {ESTADOS.map((e) => (
          <button key={e.valor} className={`ficha est-${e.valor}${filtro === e.valor ? " activa" : ""}`}
            onClick={() => setFiltro(filtro === e.valor ? "pendientes" : e.valor)} aria-pressed={filtro === e.valor}>
            <span className="ficha-icono" aria-hidden="true">{e.icono}</span>
            <b>{conteo[e.valor]}</b>
            <span>{e.texto}</span>
          </button>
        ))}
      </div>

      {nueva ? <NuevaReunion tablero={tablero} alTerminar={() => setNueva(false)} /> : (
        <button className="boton grande-ancho" onClick={() => setNueva(true)}>＋ Nueva reunión</button>
      )}

      <div className="barra-filtros">
        <Chips<Vista> opciones={[{ valor: "persona", texto: "👥 Por persona" }, { valor: "reunion", texto: "📅 Por reunión" }]} valor={vista} cambiar={setVista} />
        <Chips<Filtro> opciones={[{ valor: "pendientes", texto: "Pendientes" }, { valor: "todas", texto: "Todas" },
          ...(filtro !== "pendientes" && filtro !== "todas" ? [{ valor: filtro, texto: ESTADO[filtro].texto }] : [])]}
          valor={filtro} cambiar={setFiltro} />
        <button className={soloMias ? "chip activo" : "chip"} aria-pressed={soloMias} onClick={() => setSoloMias(!soloMias)}>Solo las mías</button>
      </div>

      <Falla error={tablero.error} />

      {vista === "persona" ? (
        tareas.length === 0 && reuniones.length === 0 ? (
          <Vacio>Todavía no hay reuniones. Crea la primera con «Nueva reunión» y anota las tareas que salieron. 🌱</Vacio>
        ) : <PorPersona tareas={visibles} tablero={tablero} reuniones={reuniones} soloMias={soloMias} />
      ) : (
        <div className="reuniones">
          {reuniones.length === 0 && sueltas.length === 0 && <Vacio>Todavía no hay reuniones. Crea la primera con «Nueva reunión». 🌱</Vacio>}
          {reuniones.map((r) => (
            <TarjetaReunion key={r.id} r={r} tablero={tablero}
              todas={tareas.filter((t) => t.reunion_id === r.id)} tareas={visibles.filter((t) => t.reunion_id === r.id)} />
          ))}
          {sueltas.length > 0 && <TarjetaReunion r={null} tablero={tablero} todas={sueltas} tareas={visibles.filter((t) => !t.reunion_id)} />}
        </div>
      )}
    </>
  );
}

// Para Hoy: mis tareas sin terminar.
export function MisTareas() {
  const tablero = useTablero();
  const { yo } = useNotas();
  if (!tablero.reuniones) return null;
  const mias = tablero.tareas.filter((t) => t.responsable === yo.email && t.estado !== "terminado").sort(ordenar);
  return (
    <section className="seccion">
      <div className="seccion-cab">
        <div>
          <h2>Tus tareas</h2>
          <p className="sub">{mias.length ? `${mias.length} sin terminar` : "Las que te asignen en Reuniones aparecen aquí"}</p>
        </div>
        <a className="boton peq secundario" href="#/reuniones">Ver reuniones</a>
      </div>
      {mias.length === 0 ? <p className="nada grande">No tienes tareas pendientes 🎉</p> : (
        <div className="tareas-hoy">
          {mias.slice(0, 6).map((t) => (
            <TarjetaTarea key={t.id} t={t} tablero={tablero} verPersona={false} verReunion
              reunion={tablero.reuniones?.find((r) => r.id === t.reunion_id)} />
          ))}
        </div>
      )}
      {mias.length > 6 && <a className="enlace pie" href="#/reuniones">Ver las {mias.length} →</a>}
    </section>
  );
}
