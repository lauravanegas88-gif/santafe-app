const n0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const n1 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export const num = (v: number | null | undefined) => (v == null ? "—" : n0.format(v));

export function pesos(v: number | null | undefined) {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `$${n1.format(v / 1_000_000)} M`;
  if (Math.abs(v) >= 1_000) return `$${n0.format(Math.round(v / 1_000))} mil`;
  return `$${n0.format(v)}`;
}

export const dolares = (v: number | null | undefined) => (v == null ? "—" : `USD ${n0.format(v)}`);

// "2026-10-01" se lee como fecha local, no UTC (si no, en Colombia sale el día anterior).
const fechaLocal = (s: string) => (s.length === 10 ? new Date(s + "T00:00:00") : new Date(s));

export const mesLargo = (s: string) =>
  fechaLocal(s).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
export const mesCorto = (s: string) =>
  fechaLocal(s).toLocaleDateString("es-CO", { month: "short", year: "2-digit" }).replace(".", "");
export const dia = (s: string) =>
  fechaLocal(s).toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(".", "");
export const diaHora = (s: string) =>
  fechaLocal(s).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function hace(s: string | null) {
  if (!s) return "nunca";
  const min = Math.round((Date.now() - Date.parse(s)) / 60_000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

// Primer día del mes actual, como lo guarda la base ("2026-10-01").
export function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Proporción 0..1 sin pasarse, para las barras.
export const prop = (real: number, meta: number | null | undefined) =>
  !meta ? 0 : Math.max(0, Math.min(1, real / meta));

export const OBJETIVOS: Record<string, string> = {
  OUTCOME_LEADS: "Formularios",
  LEAD_GENERATION: "Formularios",
  MESSAGES: "Mensajes",
  LINK_CLICKS: "Clics",
  OUTCOME_TRAFFIC: "Tráfico",
  POST_ENGAGEMENT: "Interacción",
  OUTCOME_ENGAGEMENT: "Interacción",
  VIDEO_VIEWS: "Reproducciones",
  REACH: "Alcance",
  OUTCOME_AWARENESS: "Reconocimiento",
  BRAND_AWARENESS: "Reconocimiento",
};

export const ETAPAS: Record<string, string> = { tofu: "Atracción", mofu: "Conexión", bofu: "Conversión" };

export const INDICADORES: Record<string, string> = {
  guardados_compartidos: "guardados y compartidos",
  comentarios: "comentarios",
  me_gusta: "me gusta",
  alcance: "personas alcanzadas",
};

export const capital = (s: string | null | undefined) =>
  !s ? "" : s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
