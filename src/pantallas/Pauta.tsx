import { useMemo, useState } from "react";
import { supabase, type Miembro } from "../supabase";
import { useDatos } from "../lib/datos";
import { capital, ETAPAS, mesActual, mesLargo, num, OBJETIVOS, pesos } from "../lib/formato";
import { Avance, Cargando, Falla, Seccion, Vacio } from "../ui";
import PropuestaPauta from "../PropuestaPauta";
import { Notas } from "../notas";

type Fila = {
  mes: string; campana_id: string; nombre: string; estado: string | null; objetivo_meta: string | null;
  audiencia: string | null; etapa: string | null; barrio: string | null; rango_precio: string | null;
  inversion: number; impresiones: number; alcance: number; clics: number; conversaciones: number;
  leads_formulario: number; leads: number; calificados: number; ventas: number;
};
type Reparto = { etapa: string; nombre: string; porcentaje: number };

export default function Pauta({ miembro }: { miembro: Miembro }) {
  const filas = useDatos(() => supabase.from("v_pauta_campanas").select("*").order("mes", { ascending: false }));
  const metas = useDatos(() => supabase.from("metas_mes").select("mes,pauta"));
  const reparto = useDatos(() => supabase.from("reparto_pauta").select("etapa,nombre,porcentaje"));
  const sinNombre = useDatos(() => supabase.from("v_campanas_sin_nomenclatura").select("id,nombre"));
  const todas = (filas.datos ?? []) as Fila[];

  const meses = useMemo(() => [...new Set([mesActual(), ...todas.map((f) => f.mes)])].sort().reverse(), [todas]);
  const [mes, setMes] = useState<string | null>(null);
  const elegido = mes ?? (todas.some((f) => f.mes === mesActual()) ? mesActual() : meses[1] ?? mesActual());

  if (filas.cargando) return <Cargando />;
  const delMes = todas.filter((f) => f.mes === elegido).sort((a, b) => b.inversion - a.inversion);
  const inversion = delMes.reduce((s, f) => s + Number(f.inversion), 0);
  const meta = ((metas.datos ?? []) as { mes: string; pauta: number }[]).find((m) => m.mes === elegido)?.pauta;
  const porEtapa: Record<string, number> = {};
  for (const f of delMes) porEtapa[f.etapa ?? "sin"] = (porEtapa[f.etapa ?? "sin"] ?? 0) + Number(f.inversion);
  const plan = (reparto.datos ?? []) as Reparto[];
  const leads = delMes.reduce((s, f) => s + f.leads, 0);
  const conv = delMes.reduce((s, f) => s + Number(f.conversaciones), 0);

  return (
    <>
      <Falla error={filas.error} />
      <div className="titular">
        <p className="sobre">Meta Ads</p>
        <h1>¿En qué se va la pauta?</h1>
        <div className="selector">
          <select value={elegido} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
            {meses.map((m) => <option key={m} value={m}>{capital(mesLargo(m))}</option>)}
          </select>
        </div>
      </div>

      <div className="rejilla">
        <Avance etiqueta="Invertido" real={inversion} meta={meta} formato={pesos} />
        <Avance etiqueta="Conversaciones iniciadas" real={conv}
          nota={conv ? `${pesos(inversion / conv)} cada una` : undefined} formato={num} meta={undefined} />
        <Avance etiqueta="Leads que llegaron" real={leads} meta={undefined}
          nota={leads ? `${pesos(inversion / leads)} cada uno` : "Llegan cuando arranquen los anuncios con formulario"} />
      </div>

      <PropuestaPauta admin={miembro.rol === "admin"} alGuardar={metas.recargar} />

      <Seccion titulo="Lo real contra la propuesta" sub="Cómo se repartió lo invertido este mes, por etapa del nombre de la campaña">
        <div className="tarjeta">
          {plan.length > 0 && inversion > 0 ? (
            <table className="tabla compacta">
              <thead><tr><th>Etapa</th><th>Propuesta</th><th>Real</th><th>Invertido</th></tr></thead>
              <tbody>
                {[...[...plan].sort((a, b) => ["tofu", "mofu", "bofu"].indexOf(a.etapa) - ["tofu", "mofu", "bofu"].indexOf(b.etapa)),
                  { etapa: "sin", nombre: "Sin nomenclatura", porcentaje: 0 }].map((r) => {
                  const v = porEtapa[r.etapa] ?? 0;
                  if (r.etapa === "sin" && !v) return null;
                  return (
                    <tr key={r.etapa} className={r.etapa === "sin" ? "alerta" : ""}>
                      <td><i className={`punto et-${r.etapa}`} /> {r.nombre}</td>
                      <td>{r.etapa === "sin" ? "0 %" : `${r.porcentaje} %`}</td>
                      <td><b>{Math.round((v / inversion) * 100)} %</b></td>
                      <td>{pesos(v)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <Vacio>Este mes todavía no hay inversión.</Vacio>}
          {(porEtapa.sin ?? 0) > 0 && (
            <p className="sub pie">Las campañas sin nomenclatura no dicen a quién le hablan ni en qué etapa están: no se puede medir qué clientes traen.</p>
          )}
        </div>
      </Seccion>

      {(sinNombre.datos ?? []).length > 0 && (
        <Seccion titulo="Gastando sin nomenclatura (últimos 2 días)" sub="Renombrar así: AUDIENCIA_ETAPA_BARRIO_RANGO_FORMATO_MES">
          <div className="lista">
            {((sinNombre.datos ?? []) as { id: string; nombre: string }[]).map((c) => (
              <div key={c.id} className="fila"><span className="semaforo amarillo" /><span className="crece">{c.nombre}</span></div>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Campañas del mes" sub={`${delMes.length} campañas, de mayor a menor inversión`}>
        {delMes.length === 0 ? <Vacio>Sin campañas con inversión este mes.</Vacio> : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr><th>Campaña</th><th>Objetivo</th><th>Invertido</th><th>Conversaciones</th><th>Leads</th><th>Costo por lead</th></tr>
              </thead>
              <tbody>
                {delMes.map((f) => (
                  <tr key={f.campana_id}>
                    <td className="nombre-camp">
                      <div>{f.nombre}</div>
                      {f.audiencia ? (
                        <div className="etiquetas">
                          <span className="insignia">{f.audiencia}</span>
                          {f.etapa && <span className={`insignia et-${f.etapa}`}>{ETAPAS[f.etapa]}</span>}
                          {f.barrio && <span className="insignia">{capital(f.barrio)}</span>}
                          {f.rango_precio && <span className="insignia">{f.rango_precio}</span>}
                        </div>
                      ) : <span className="insignia alerta">sin nomenclatura</span>}
                      <Notas contexto={`campana:${f.campana_id}`} titulo={`Campaña ${f.nombre}`} ruta="pauta" />
                    </td>
                    <td>{OBJETIVOS[f.objetivo_meta ?? ""] ?? f.objetivo_meta ?? "—"}</td>
                    <td>{pesos(f.inversion)}</td>
                    <td>{num(f.conversaciones)}</td>
                    <td>{f.leads}{f.calificados > 0 && <small> ({f.calificados} calif.)</small>}</td>
                    <td>{f.leads ? pesos(f.inversion / f.leads) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Notas de la pauta del mes">
        <div className="tarjeta">
          <Notas contexto={`pauta:${elegido}`} titulo={`Pauta de ${mesLargo(elegido)}`} ruta="pauta" abierto />
        </div>
      </Seccion>
    </>
  );
}
