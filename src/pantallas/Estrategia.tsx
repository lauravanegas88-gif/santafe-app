import { useState } from "react";
import { supabase, type Miembro } from "../supabase";
import { useDatos } from "../lib/datos";
import { capital, dia, INDICADORES, mesLargo, pesos } from "../lib/formato";
import { Cargando, Falla, Md, Seccion } from "../ui";
import PropuestaPauta from "../PropuestaPauta";
import { Notas } from "../notas";

type Parte = { id: string; orden: number; titulo: string; contenido: string; actualizado: string; actualizado_por: string | null };
type MetaMes = {
  mes: string; fase: string | null; ventas: number | null; formularios_propietarios: number | null; consignaciones: number | null;
  formularios_compradores: number | null; publicaciones_feed: number | null; creativos_nuevos: number | null; pauta: number | null;
};
type Barrio = { barrio: string; nombre: string; bloque: number; foco: number; nota: string | null };
type Bloque = { bloque: number; nombre: string; nota: string | null };
type Linea = { linea: string; nombre: string; objetivo: string; indicador: string; orden: number };

const COLUMNAS: { k: keyof MetaMes; t: string }[] = [
  { k: "ventas", t: "Ventas" },
  { k: "formularios_propietarios", t: "Form. propietarios" },
  { k: "consignaciones", t: "Consignaciones" },
  { k: "formularios_compradores", t: "Form. compradores" },
  { k: "publicaciones_feed", t: "Publicaciones" },
  { k: "creativos_nuevos", t: "Creativos nuevos" },
  { k: "pauta", t: "Pauta" },
];

export default function Estrategia({ miembro }: { miembro: Miembro }) {
  const admin = miembro.rol === "admin";
  const partes = useDatos(() => supabase.from("estrategia").select("*").order("orden"));
  const metas = useDatos(() => supabase.from("metas_mes").select("*").order("mes"));
  const barrios = useDatos(() => supabase.from("barrios_foco").select("*").order("bloque").order("foco").order("nombre"));
  const bloques = useDatos(() => supabase.from("bloques_precio").select("*").order("bloque"));
  const lineas = useDatos(() => supabase.from("lineas_contenido").select("*").order("orden"));

  if (partes.cargando) return <Cargando />;
  const lista = (partes.datos ?? []) as Parte[];

  const extra: Record<string, JSX.Element> = {
    meta: <Metas filas={(metas.datos ?? []) as MetaMes[]} admin={admin} recargar={metas.recargar} />,
    contenido: (
      <>
        <Lineas filas={(lineas.datos ?? []) as Linea[]} />
        <Barrios barrios={(barrios.datos ?? []) as Barrio[]} bloques={(bloques.datos ?? []) as Bloque[]} />
      </>
    ),
    pauta: <PropuestaPauta admin={admin} alGuardar={metas.recargar} />,
  };

  return (
    <>
      <Falla error={partes.error} />
      <div className="titular">
        <p className="sobre">Octubre 2026 a marzo 2027</p>
        <h1>La estrategia</h1>
        <p className="sub">Lo que vamos a hacer y por qué. {admin ? "Como administradora puedes editar cada parte." : ""}</p>
      </div>
      <div className="chips indice">
        {lista.map((p) => (
          <button key={p.id} className="chip" onClick={() => document.getElementById(`parte-${p.id}`)?.scrollIntoView({ behavior: "smooth" })}>
            {p.titulo}
          </button>
        ))}
      </div>
      {lista.map((p) => (
        <div key={p.id} id={`parte-${p.id}`}>
          <ParteTexto parte={p} admin={admin} quien={miembro.email} recargar={partes.recargar} />
          {extra[p.id]}
        </div>
      ))}
    </>
  );
}

function ParteTexto({ parte, admin, quien, recargar }: { parte: Parte; admin: boolean; quien: string; recargar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(parte.contenido);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const { error } = await supabase.from("estrategia")
      .update({ contenido: texto, actualizado: new Date().toISOString(), actualizado_por: quien })
      .eq("id", parte.id);
    if (error) return setError(error.message);
    setEditando(false);
    recargar();
  }

  return (
    <Seccion titulo={parte.titulo}
      accion={admin && !editando ? <button className="boton peq secundario" onClick={() => { setTexto(parte.contenido); setEditando(true); }}>Editar</button> : undefined}>
      {editando ? (
        <div className="editor">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.max(8, texto.split("\n").length + 2)} />
          <p className="sub">**negrilla**, una línea que empiece con «- » es una viñeta, «1. » una lista numerada.</p>
          {error && <p className="falla">{error}</p>}
          <div className="botones">
            <button className="boton peq" onClick={guardar}>Guardar</button>
            <button className="boton peq secundario" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="tarjeta">
          <Md texto={parte.contenido} />
          {parte.actualizado_por && <p className="sub pie">Editado {dia(parte.actualizado)} por {parte.actualizado_por}</p>}
          <Notas contexto={`estrategia:${parte.id}`} titulo={`Estrategia · ${parte.titulo}`} ruta="estrategia" />
        </div>
      )}
    </Seccion>
  );
}

function Metas({ filas, admin, recargar }: { filas: MetaMes[]; admin: boolean; recargar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<MetaMes[]>([]);
  const [error, setError] = useState<string | null>(null);
  const total = (k: keyof MetaMes) => filas.reduce((s, f) => s + (Number(f[k]) || 0), 0);

  async function guardar() {
    const { error } = await supabase.from("metas_mes").upsert(borrador);
    if (error) return setError(error.message);
    setEditando(false);
    recargar();
  }

  const datos = editando ? borrador : filas;
  return (
    <Seccion titulo="Metas por mes"
      accion={admin && !editando ? <button className="boton peq secundario" onClick={() => { setBorrador(filas.map((f) => ({ ...f }))); setEditando(true); }}>Editar</button> : undefined}>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr><th>Mes</th>{COLUMNAS.map((c) => <th key={c.k}>{c.t}</th>)}</tr>
          </thead>
          <tbody>
            {datos.map((f, i) => (
              <tr key={f.mes}>
                <td><b>{capital(mesLargo(f.mes).split(" ")[0])}</b><div className="sub">{f.fase}</div></td>
                {COLUMNAS.map((c) => (
                  <td key={c.k}>
                    {editando ? (
                      <input className="num" type="number" inputMode="numeric" value={(f[c.k] as number | null) ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          setBorrador((b) => b.map((x, j) => (j === i ? { ...x, [c.k]: v } : x)));
                        }} />
                    ) : c.k === "pauta" ? pesos(f.pauta) : (f[c.k] as number | null) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            {!editando && (
              <tr className="total">
                <td>Total</td>
                {COLUMNAS.map((c) => <td key={c.k}>{c.k === "pauta" ? pesos(total(c.k)) : total(c.k)}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Notas contexto="estrategia:metas" titulo="Metas por mes" ruta="estrategia" />
      {editando && (
        <div className="botones">
          {error && <p className="falla">{error}</p>}
          <button className="boton peq" onClick={guardar}>Guardar metas</button>
          <button className="boton peq secundario" onClick={() => setEditando(false)}>Cancelar</button>
        </div>
      )}
    </Seccion>
  );
}

function Lineas({ filas }: { filas: Linea[] }) {
  return (
    <Seccion titulo="Cómo se califica cada publicación" sub="Cada publicación se compara con la mitad de las de su misma línea en el último año">
      <div className="rejilla">
        {filas.map((l) => (
          <div key={l.linea} className={`tarjeta linea-${l.linea}`}>
            <div className="etq">{l.nombre}</div>
            <p>{l.objetivo}</p>
            <p className="sub">Se mide por <b>{INDICADORES[l.indicador]}</b></p>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

function Barrios({ barrios, bloques }: { barrios: Barrio[]; bloques: Bloque[] }) {
  return (
    <Seccion titulo="Barrios por bloque de precio" sub="Foco 1 desde octubre. Foco 2 entra después.">
      <div className="rejilla">
        {bloques.map((b) => (
          <div key={b.bloque} className="tarjeta">
            <div className="etq">Bloque {b.bloque} · {b.nombre}</div>
            {b.nota && <p className="sub">{b.nota}</p>}
            {[1, 2].map((foco) => {
              const de = barrios.filter((x) => x.bloque === b.bloque && x.foco === foco);
              if (!de.length) return null;
              return (
                <div key={foco} className="foco">
                  <span className={`insignia foco${foco}`}>Foco {foco}</span>
                  <ul>
                    {de.map((x) => <li key={x.barrio}><b>{x.nombre}</b>{x.nota && <span className="sub"> · {x.nota}</span>}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Seccion>
  );
}
