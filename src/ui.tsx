import { marked } from "marked";
import DOMPurify from "dompurify";
import type { ReactNode } from "react";
import { prop } from "./lib/formato";

export function Seccion({ titulo, sub, accion, children }: { titulo: string; sub?: ReactNode; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="seccion">
      <div className="seccion-cab">
        <div>
          <h2>{titulo}</h2>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

// Número grande contra su meta, con barra de avance.
export function Avance({ etiqueta, real, meta, formato = (v: number) => String(v), nota }: {
  etiqueta: string; real: number; meta: number | null | undefined; formato?: (v: number) => string; nota?: ReactNode;
}) {
  const p = prop(real, meta);
  return (
    <div className="tarjeta avance">
      <div className="etq">{etiqueta}</div>
      <div className="cifra">
        {formato(real)}
        {meta != null && <span className="de"> de {formato(meta)}</span>}
      </div>
      {meta != null && (
        <div className="barra" aria-label={`${Math.round(p * 100)} %`}>
          <span style={{ width: `${p * 100}%` }} className={p >= 1 ? "lleno" : ""} />
        </div>
      )}
      {nota && <div className="nota-peq">{nota}</div>}
    </div>
  );
}

export function Cargando() {
  return <div className="cargando">Cargando…</div>;
}

export function Falla({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="falla">No se pudo cargar: {error}</div>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="vacio">{children}</div>;
}

export function Chips<T extends string>({ opciones, valor, cambiar }: {
  opciones: { valor: T; texto: string }[]; valor: T; cambiar: (v: T) => void;
}) {
  return (
    <div className="chips" role="tablist">
      {opciones.map((o) => (
        <button key={o.valor} role="tab" aria-selected={o.valor === valor}
          className={o.valor === valor ? "chip activo" : "chip"} onClick={() => cambiar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Md({ texto }: { texto: string }) {
  const html = DOMPurify.sanitize(marked.parse(texto, { async: false }) as string);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

// Nota de 1 a 5 como puntos.
export function Puntos({ nota }: { nota: number | null }) {
  if (nota == null) return <span className="puntos sin">sin datos</span>;
  return (
    <span className={`puntos n${nota}`} aria-label={`${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= nota ? "on" : ""} />)}
    </span>
  );
}
