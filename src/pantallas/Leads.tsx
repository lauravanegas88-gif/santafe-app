import { useMemo, useState } from "react";
import { supabase, type Miembro } from "../supabase";
import { useDatos } from "../lib/datos";
import { capital, diaHora, pesos } from "../lib/formato";
import { Cargando, Chips, Falla, Seccion, Vacio } from "../ui";

type Origen = {
  tipo: string; pieza_id: string; nombre: string; leads: number; calificados: number; ventas: number;
  inversion: number | null; costo_por_lead: number | null; costo_por_calificado: number | null; permalink: string | null;
};
type Lead = {
  id: string; creado: string; canal: string | null; audiencia: string | null; nombre: string | null;
  telefono: string | null; telefono_norm: string | null; email: string | null; intencion: string | null; plazo: string | null;
  zona: string | null; presupuesto: string | null; financiacion: string | null; tipo_inmueble: string | null;
  calificacion: string | null; estado: string | null; palabra_clave: string | null;
  campana: string | null; publicacion: string | null; permalink: string | null;
};

const TIPOS: Record<string, string> = { campana: "Anuncio", publicacion: "Publicación", palabra: "Palabra clave", directo: "Directo" };

function whatsapp(t: string | null) {
  const d = (t ?? "").replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.length === 10 && d.startsWith("3") ? "57" + d : d}`;
}

export default function Leads({ miembro }: { miembro: Miembro }) {
  const veContacto = miembro.rol !== "equipo";
  const origenes = useDatos(() => supabase.from("v_origenes").select("*").order("leads", { ascending: false }).limit(50));

  return (
    <>
      <div className="titular">
        <p className="sobre">Formularios y mensajes</p>
        <h1>¿Qué trae clientes?</h1>
        <p className="sub">Cada lead queda amarrado al anuncio, la publicación o la palabra clave que lo trajo.</p>
      </div>

      <Seccion titulo="Por origen" sub="Lo que más leads ha traído, con lo que costó cada uno">
        <Falla error={origenes.error} />
        {origenes.cargando ? <Cargando /> : (origenes.datos ?? []).length === 0 ? (
          <Vacio>Todavía no llegan leads. Empiezan a aparecer cuando arranquen los anuncios con formulario y ManyChat.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th>Origen</th><th>Leads</th><th>Calificados</th><th>Ventas</th><th>Costo por calificado</th></tr></thead>
              <tbody>
                {((origenes.datos ?? []) as Origen[]).map((o) => (
                  <tr key={o.tipo + o.pieza_id}>
                    <td className="nombre-camp">
                      <div>{o.permalink ? <a href={o.permalink} target="_blank" rel="noreferrer">{o.nombre}</a> : o.nombre}</div>
                      <span className="insignia">{TIPOS[o.tipo]}</span>
                    </td>
                    <td>{o.leads}</td><td>{o.calificados}</td><td>{o.ventas}</td>
                    <td>{pesos(o.costo_por_calificado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      {veContacto ? <ListaLeads /> : (
        <p className="aviso">Los nombres y teléfonos de los leads solo los ven ventas y administración.</p>
      )}
    </>
  );
}

function ListaLeads() {
  const [audiencia, setAudiencia] = useState("todos");
  const [calif, setCalif] = useState("todos");
  const { datos, error, cargando } = useDatos(() => supabase.from("v_leads").select("*").order("creado", { ascending: false }).limit(300));

  const lista = useMemo(() => ((datos ?? []) as Lead[]).filter((l) =>
    (audiencia === "todos" || l.audiencia === audiencia) && (calif === "todos" || (l.calificacion ?? "sin") === calif)), [datos, audiencia, calif]);

  return (
    <Seccion titulo="Lista de leads" sub="Los más recientes primero">
      <Chips opciones={[{ valor: "todos", texto: "Todos" }, { valor: "propietarios", texto: "Propietarios" }, { valor: "compradores", texto: "Compradores" }]}
        valor={audiencia} cambiar={setAudiencia} />
      <Chips opciones={[{ valor: "todos", texto: "Cualquier calificación" }, { valor: "calificado", texto: "Calificados" }, { valor: "tibio", texto: "Tibios" }, { valor: "descartado", texto: "Descartados" }, { valor: "sin", texto: "Sin calificar" }]}
        valor={calif} cambiar={setCalif} />
      <Falla error={error} />
      {cargando ? <Cargando /> : lista.length === 0 ? <Vacio>No hay leads con estos filtros.</Vacio> : (
        <div className="lista-pubs">
          {lista.map((l) => {
            const wa = whatsapp(l.telefono_norm ?? l.telefono);
            const origen = l.campana ?? l.publicacion ?? (l.palabra_clave ? `Comenta ${l.palabra_clave}` : "Directo");
            return (
              <article key={l.id} className="tarjeta lead">
                <div className="pub-cab">
                  <b>{l.nombre ?? "Sin nombre"}</b>
                  {l.audiencia && <span className="insignia">{l.audiencia}</span>}
                  <span className={`insignia cal-${l.calificacion ?? "sin"}`}>{l.calificacion ?? "sin calificar"}</span>
                  <span className="sub">{diaHora(l.creado)}</span>
                </div>
                <dl className="datos">
                  {l.zona && <><dt>Zona</dt><dd>{capital(l.zona)}</dd></>}
                  {l.presupuesto && <><dt>Presupuesto</dt><dd>{l.presupuesto}</dd></>}
                  {l.plazo && <><dt>Plazo</dt><dd>{l.plazo}</dd></>}
                  {l.financiacion && <><dt>Financiación</dt><dd>{l.financiacion}</dd></>}
                  {l.tipo_inmueble && <><dt>Inmueble</dt><dd>{l.tipo_inmueble}</dd></>}
                  <dt>Llegó por</dt><dd>{l.permalink ? <a href={l.permalink} target="_blank" rel="noreferrer">{origen}</a> : origen}{l.canal ? ` · ${l.canal}` : ""}</dd>
                </dl>
                <div className="botones">
                  {wa && <a className="boton peq" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
                  {l.telefono && <a className="boton peq secundario" href={`tel:${l.telefono}`}>Llamar</a>}
                  {l.email && <a className="boton peq secundario" href={`mailto:${l.email}`}>Correo</a>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Seccion>
  );
}
