import { supabase } from "../supabase";
import { useDatos } from "../lib/datos";
import { dia, hace, mesActual, mesLargo, num, pesos, capital } from "../lib/formato";
import { Avance, Cargando, Falla, Seccion, Vacio } from "../ui";

type Mes = {
  mes: string; fase: string | null; meta_ventas: number | null; meta_formularios_propietarios: number | null;
  meta_consignaciones: number | null; meta_formularios_compradores: number | null; meta_publicaciones: number | null;
  meta_pauta: number | null; ventas: number; formularios_propietarios: number; propietarios_calificados: number;
  formularios_compradores: number; compradores_calificados: number; inversion: number; conversaciones: number;
  publicaciones: number;
};
type Semana = {
  semana: string; formularios_propietarios: number; propietarios_calificados: number; formularios_compradores: number;
  compradores_calificados: number; ventas: number; inversion: number; conversaciones: number;
};
type Motor = { motor: string; fin: string | null; ok: boolean | null; filas: number | null; detalle: string | null };

const MOTORES: Record<string, string> = {
  "sync-pauta": "Pauta de Meta",
  "sync-leads": "Formularios de Meta",
  "sync-organico": "Publicaciones de Instagram",
  "webhook-manychat": "Mensajes (ManyChat)",
  vigilante: "Vigilante",
  "sync-ventas": "Ventas",
};

export default function Hoy() {
  const meses = useDatos(() => supabase.from("v_resumen_mes").select("*").order("mes"));
  const semanas = useDatos(() => supabase.from("v_pulso_semanal").select("*").order("semana", { ascending: false }).limit(6));
  const motores = useDatos(() => supabase.from("v_salud_motores").select("motor,fin,ok,filas,detalle"));
  const sinNombre = useDatos(() => supabase.from("v_campanas_sin_nomenclatura").select("id,nombre"));

  if (meses.cargando) return <Cargando />;
  const filas = (meses.datos ?? []) as Mes[];
  const hoy = mesActual();
  const m = filas.find((f) => f.mes === hoy);
  const plan = filas.filter((f) => f.meta_ventas != null);
  const ventasPlan = plan.reduce((s, f) => s + f.ventas, 0);
  const metaPlan = plan.reduce((s, f) => s + (f.meta_ventas ?? 0), 0);
  const d = new Date();
  const diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  return (
    <>
      <Falla error={meses.error} />
      <div className="titular">
        <p className="sobre">{capital(mesLargo(hoy))}{m?.fase ? ` · ${m.fase}` : ""}</p>
        <h1>¿Cómo vamos este mes?</h1>
        <p className="sub">Vamos en el día {d.getDate()} de {diasMes}. Las cifras se actualizan solas cada hora.</p>
      </div>

      {m ? (
        <div className="rejilla">
          <Avance etiqueta="Ventas" real={m.ventas} meta={m.meta_ventas}
            nota={m.ventas === 0 ? "Las ventas llegan cuando se conecte el Excel de incentivos" : undefined} />
          <Avance etiqueta="Formularios de propietarios" real={m.formularios_propietarios} meta={m.meta_formularios_propietarios}
            nota={`${m.propietarios_calificados} calificados`} />
          <Avance etiqueta="Formularios de compradores" real={m.formularios_compradores} meta={m.meta_formularios_compradores}
            nota={`${m.compradores_calificados} calificados`} />
          <Avance etiqueta="Pauta invertida" real={m.inversion} meta={m.meta_pauta} formato={pesos}
            nota={`${num(m.conversaciones)} conversaciones iniciadas`} />
          <Avance etiqueta="Publicaciones en el feed" real={m.publicaciones} meta={m.meta_publicaciones} />
          <Avance etiqueta="Consignaciones" real={0} meta={m.meta_consignaciones} nota="Pendiente: falta la fuente de este dato" />
        </div>
      ) : (
        <Vacio>Este mes no tiene metas. Las metas van de octubre de 2026 a marzo de 2027.</Vacio>
      )}

      {plan.length > 0 && (
        <Seccion titulo={`Las ${metaPlan} ventas del plan`} sub={`${capital(mesLargo(plan[0].mes))} a ${mesLargo(plan[plan.length - 1].mes)}`}>
          <div className="tarjeta">
            <div className="cifra">{ventasPlan}<span className="de"> de {metaPlan}</span></div>
            <div className="barra"><span style={{ width: `${Math.min(100, (ventasPlan / metaPlan) * 100)}%` }} /></div>
            <div className="meses-mini">
              {plan.map((f) => (
                <div key={f.mes} className={f.mes === hoy ? "actual" : ""}>
                  <b>{f.ventas}<small>/{f.meta_ventas}</small></b>
                  <span>{mesLargo(f.mes).split(" ")[0].slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Pulso semanal" sub="Semanas de lunes a domingo, la más reciente arriba">
        {semanas.cargando ? <Cargando /> : (semanas.datos ?? []).length === 0 ? <Vacio>Todavía no hay semanas con datos.</Vacio> : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr><th>Semana</th><th>Propietarios</th><th>Compradores</th><th>Ventas</th><th>Pauta</th><th>Conversaciones</th></tr>
              </thead>
              <tbody>
                {(semanas.datos as Semana[]).map((s) => (
                  <tr key={s.semana}>
                    <td>{dia(s.semana)}</td>
                    <td>{s.formularios_propietarios} <small>({s.propietarios_calificados} calif.)</small></td>
                    <td>{s.formularios_compradores} <small>({s.compradores_calificados} calif.)</small></td>
                    <td>{s.ventas}</td>
                    <td>{pesos(s.inversion)}</td>
                    <td>{num(s.conversaciones)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sub">Todavía sin fuente automática: visitas de avalúo, consignaciones y visitas a inmuebles.</p>
      </Seccion>

      <Seccion titulo="¿El sistema está al día?" sub="Cada motor trae datos solo. Si uno falla, el vigilante avisa por correo.">
        <div className="lista">
          {((motores.datos ?? []) as Motor[]).map((x) => (
            <div key={x.motor} className="fila">
              <span className={`semaforo ${x.ok === false ? "rojo" : x.ok ? "verde" : "gris"}`} />
              <div className="crece">
                <b>{MOTORES[x.motor] ?? x.motor}</b>
                {x.ok === false && x.detalle && <div className="sub">{x.detalle}</div>}
              </div>
              <span className="sub">{hace(x.fin)}</span>
            </div>
          ))}
          {(sinNombre.datos ?? []).length > 0 && (
            <div className="fila">
              <span className="semaforo amarillo" />
              <div className="crece">
                <b>{(sinNombre.datos ?? []).length} campañas gastando sin nomenclatura</b>
                <div className="sub">No se puede saber qué clientes traen. Ver Pauta.</div>
              </div>
            </div>
          )}
        </div>
      </Seccion>
    </>
  );
}
