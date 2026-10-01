import { useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useDatos } from "../lib/datos";
import { capital, dia, INDICADORES, num } from "../lib/formato";
import { Cargando, Chips, Falla, Puntos, Seccion, Vacio } from "../ui";

type Pub = {
  id: string; formato: string | null; permalink: string | null; publicada: string; titulo: string;
  linea: string; linea_nombre: string; objetivo: string; indicador: string; como_mejorar: string | null;
  barrio: string | null; alcance: number | null; me_gusta: number | null; comentarios: number | null;
  guardados: number | null; compartidos: number | null; reproducciones: number | null;
  leads: number; calificados: number; resultado: number | null; mediana: number | null; nota: number | null;
};

const FORMATOS: Record<string, string> = { REELS: "Reel", CAROUSEL_ALBUM: "Carrusel", IMAGE: "Imagen", VIDEO: "Video" };

export default function Contenido() {
  const [linea, setLinea] = useState("todas");
  const [periodo, setPeriodo] = useState<"30" | "90" | "365">("90");
  const [orden, setOrden] = useState<"fecha" | "mejor" | "peor">("fecha");

  const { datos, error, cargando } = useDatos(() => {
    const desde = new Date(Date.now() - Number(periodo) * 86_400_000).toISOString();
    return supabase.from("v_contenido_app").select("*").gte("publicada", desde).order("publicada", { ascending: false });
  }, [periodo]);

  const todas = (datos ?? []) as Pub[];
  const lista = useMemo(() => {
    const l = todas.filter((p) => linea === "todas" || p.linea === linea);
    if (orden === "mejor") return [...l].sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0));
    if (orden === "peor") return [...l].sort((a, b) => (a.nota ?? 9) - (b.nota ?? 9));
    return l;
  }, [todas, linea, orden]);

  const resumen = useMemo(() => {
    const r: Record<string, { nombre: string; n: number; suma: number; con: number }> = {};
    for (const p of todas) {
      r[p.linea] ??= { nombre: p.linea_nombre, n: 0, suma: 0, con: 0 };
      r[p.linea].n++;
      if (p.nota != null) { r[p.linea].suma += p.nota; r[p.linea].con++; }
    }
    return r;
  }, [todas]);

  const ordenLineas = ["barrios", "inmuebles", "santafe", "otro"];
  const total = todas.length;

  return (
    <>
      <div className="titular">
        <p className="sobre">Instagram</p>
        <h1>¿Qué está funcionando?</h1>
        <p className="sub">Nota de 1 a 5: compara cada publicación con lo normal de su misma línea. 3 es lo normal; 5, más del doble.</p>
      </div>
      <Chips opciones={[{ valor: "30", texto: "30 días" }, { valor: "90", texto: "3 meses" }, { valor: "365", texto: "1 año" }]}
        valor={periodo} cambiar={setPeriodo} />
      <Falla error={error} />
      {cargando ? <Cargando /> : (
        <>
          <div className="rejilla mini">
            {ordenLineas.filter((l) => resumen[l]).map((l) => (
              <button key={l} className={`tarjeta resumen-linea linea-${l} ${linea === l ? "activo" : ""}`}
                onClick={() => setLinea(linea === l ? "todas" : l)}>
                <div className="etq">{resumen[l].nombre}</div>
                <div className="cifra">{Math.round((resumen[l].n / total) * 10)}<span className="de"> de cada 10</span></div>
                <div className="sub">{resumen[l].n} publicaciones · nota media {resumen[l].con ? (resumen[l].suma / resumen[l].con).toFixed(1) : "—"}</div>
              </button>
            ))}
          </div>
          {resumen.otro && (
            <p className="aviso">
              {Math.round((resumen.otro.n / total) * 10)} de cada 10 publicaciones están por fuera del plan (consejos, frases, fechas especiales). El plan las pasa a historias.
            </p>
          )}

          <Seccion titulo={linea === "todas" ? "Todas las publicaciones" : resumen[linea]?.nombre ?? ""}
            sub={`${lista.length} publicaciones`}
            accion={<select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} aria-label="Ordenar">
              <option value="fecha">Más recientes</option>
              <option value="mejor">Mejor nota</option>
              <option value="peor">Peor nota</option>
            </select>}>
            {lista.length === 0 ? <Vacio>No hay publicaciones en este periodo.</Vacio> : (
              <div className="lista-pubs">{lista.map((p) => <Tarjeta key={p.id} p={p} />)}</div>
            )}
          </Seccion>
        </>
      )}
    </>
  );
}

function Tarjeta({ p }: { p: Pub }) {
  const veces = p.resultado != null && p.mediana ? p.resultado / p.mediana : null;
  let consejo: string | null = null;
  if (p.linea === "otro") consejo = p.como_mejorar;
  else if (p.nota != null && p.nota <= 2) consejo = p.como_mejorar;
  else if (p.nota === 5) consejo = "Funcionó muy bien: repetir el formato y el tema.";

  return (
    <article className={`tarjeta pub linea-${p.linea}`}>
      <div className="pub-cab">
        <span className="insignia">{p.linea_nombre}</span>
        <span className="sub">{dia(p.publicada)} · {FORMATOS[p.formato ?? ""] ?? p.formato}{p.barrio ? ` · ${capital(p.barrio)}` : ""}</span>
        <Puntos nota={p.nota} />
      </div>
      <h3>{p.titulo || "(sin texto)"}</h3>
      <p className="sub">
        {p.resultado == null ? "Sin métricas todavía." : (
          <>
            <b>{num(p.resultado)} {INDICADORES[p.indicador]}</b>
            {p.mediana != null && <> · lo normal en su línea es {num(p.mediana)}</>}
            {veces != null && veces >= 1.25 && <> · {veces.toFixed(1).replace(".", ",")} veces más</>}
          </>
        )}
      </p>
      <div className="metricas">
        <span>👁 {num(p.alcance)}</span><span>♥ {num(p.me_gusta)}</span><span>💬 {num(p.comentarios)}</span>
        <span>🔖 {num(p.guardados)}</span><span>↗ {num(p.compartidos)}</span>
        {p.leads > 0 && <span className="destaca">{p.leads} leads ({p.calificados} calif.)</span>}
      </div>
      {consejo && <p className="consejo">{consejo}</p>}
      {p.permalink && <a className="enlace" href={p.permalink} target="_blank" rel="noreferrer">Ver en Instagram →</a>}
    </article>
  );
}
