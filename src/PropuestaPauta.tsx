import { useState } from "react";
import { supabase } from "./supabase";
import { useDatos } from "./lib/datos";
import { dolares, mesActual, pesos } from "./lib/formato";
import { Cargando, Falla, Seccion } from "./ui";
import { Notas } from "./notas";

// La propuesta de pauta: cuánto se invierte al mes y cómo se reparte, por objetivo.
// Las cifras viven en la base (pauta_propuesta y reparto_propuesta), no en el código público.

type Monto = { monto_usd: number; tasa_cop: number; nota: string | null };
type Porcion = {
  porcion: string; orden: number; nombre: string; porcentaje: number; etapa: string;
  objetivo_meta: string; que_hace: string; se_mide: string;
};

export default function PropuestaPauta({ admin, alGuardar }: { admin: boolean; alGuardar?: () => void }) {
  const monto = useDatos(() => supabase.from("pauta_propuesta").select("monto_usd,tasa_cop,nota").maybeSingle());
  const reparto = useDatos(() => supabase.from("reparto_propuesta").select("*").order("orden"));
  const [editando, setEditando] = useState(false);
  const [usd, setUsd] = useState("");
  const [tasa, setTasa] = useState("");
  const [falla, setFalla] = useState<string | null>(null);

  if (monto.cargando || reparto.cargando) return <Cargando />;
  const m = monto.datos as Monto | null;
  const porciones = (reparto.datos ?? []) as Porcion[];
  if (!m) return <Falla error={monto.error ?? reparto.error} />;

  async function guardar() {
    const u = Number(usd), t = Number(tasa);
    if (!(u >= 0) || !(t > 0)) return setFalla("Revisa el monto y la tasa.");
    const { error } = await supabase.from("pauta_propuesta").update({ monto_usd: u, tasa_cop: t, actualizado: new Date().toISOString() }).eq("id", 1);
    if (error) return setFalla(error.message);
    // La meta de pauta de este mes en adelante sigue a la propuesta.
    const r = await supabase.from("metas_mes").update({ pauta: Math.round(u * t) }).gte("mes", mesActual());
    if (r.error) return setFalla(r.error.message);
    setEditando(false);
    monto.recargar();
    alGuardar?.();
  }

  return (
    <Seccion titulo="La propuesta de inversión"
      sub="Cuánto se invierte al mes y en qué objetivo, según la propuesta inicial"
      accion={admin && !editando ? (
        <button className="boton peq secundario" onClick={() => { setUsd(String(m.monto_usd)); setTasa(String(m.tasa_cop)); setEditando(true); }}>Editar</button>
      ) : undefined}>
      <div className="tarjeta propuesta">
        {editando ? (
          <div className="formulario">
            <label>Inversión al mes (dólares)<input type="number" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} /></label>
            <label>Tasa de referencia (pesos por dólar)<input type="number" inputMode="decimal" value={tasa} onChange={(e) => setTasa(e.target.value)} /></label>
            <p className="sub">Al guardar, la meta de pauta de este mes en adelante pasa a ser {pesos(Number(usd) * Number(tasa) || 0)}.</p>
            {falla && <p className="falla">{falla}</p>}
            <div className="botones">
              <button className="boton peq" onClick={guardar}>Guardar</button>
              <button className="boton peq secundario" onClick={() => setEditando(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="etq">Inversión en publicidad al mes</div>
            <div className="cifra">{dolares(m.monto_usd)}<span className="de"> · unos {pesos(m.monto_usd * m.tasa_cop)} con el dólar a {pesos(m.tasa_cop)}</span></div>
            {m.nota && <p className="sub">{m.nota}</p>}
          </>
        )}
        <div className="reparto grande">
          {porciones.map((p) => (
            <span key={p.porcion} className={`por-${p.porcion}`} style={{ flexGrow: p.porcentaje }} title={p.nombre}>{p.porcentaje} %</span>
          ))}
        </div>
      </div>

      <div className="rejilla porciones">
        {porciones.map((p) => (
          <article key={p.porcion} className={`tarjeta porcion borde-${p.porcion}`}>
            <div className="porcion-cab">
              <span className={`muestra por-${p.porcion}`} />
              <span className="etq">{p.nombre}</span>
            </div>
            <div className="cifra">{p.porcentaje} %<span className="de"> · {dolares(m.monto_usd * p.porcentaje / 100)} ≈ {pesos(m.monto_usd * m.tasa_cop * p.porcentaje / 100)}</span></div>
            <dl className="datos">
              <dt>Objetivo en Meta</dt><dd><b>{p.objetivo_meta}</b></dd>
              <dt>Qué hace</dt><dd>{p.que_hace}</dd>
              <dt>Se mide por</dt><dd>{p.se_mide}</dd>
              <dt>Nombre de campaña</dt><dd><code>{p.etapa.toUpperCase()}</code></dd>
            </dl>
            <Notas contexto={`propuesta:${p.porcion}`} titulo={`Propuesta · ${p.nombre}`} ruta="pauta" />
          </article>
        ))}
      </div>
    </Seccion>
  );
}
