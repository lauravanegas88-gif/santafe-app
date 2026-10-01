import { useEffect, useState } from "react";
import { Escribir, marcarVisto, TarjetaNota, useNotas } from "../notas";
import { Chips, Falla, Seccion, Vacio } from "../ui";

type Filtro = "todas" | "mias-menciones" | "escritas";

export default function Notas() {
  const { notas, yo, error } = useNotas();
  const [filtro, setFiltro] = useState<Filtro>("todas");

  useEffect(() => { marcarVisto(); }, [notas.length]);

  const lista = notas.filter((n) =>
    filtro === "todas" || (filtro === "mias-menciones" ? n.menciones.includes(yo.email) : n.autor_email === yo.email));
  const menciones = notas.filter((n) => n.menciones.includes(yo.email)).length;

  return (
    <>
      <div className="titular">
        <p className="sobre">Conversación del equipo</p>
        <h1>Notas</h1>
        <p className="sub">
          Todas las notas de la app en un solo lugar. Para avisarle a alguien escribe @ y elige su nombre: le llega un correo con la nota y el enlace.
        </p>
      </div>

      <Seccion titulo="Nota general">
        <div className="tarjeta">
          <Escribir contexto="general" titulo="Nota general" ruta="notas" />
        </div>
      </Seccion>

      <Seccion titulo="Lo último">
        <Chips<Filtro> opciones={[
          { valor: "todas", texto: "Todas" },
          { valor: "mias-menciones", texto: `Me mencionaron${menciones ? ` (${menciones})` : ""}` },
          { valor: "escritas", texto: "Las que escribí" },
        ]} valor={filtro} cambiar={setFiltro} />
        <Falla error={error} />
        {lista.length === 0 ? (
          <Vacio>{filtro === "todas" ? "Todavía no hay notas. Deja la primera arriba o en cualquier publicación, campaña o lead." : "No hay notas aquí."}</Vacio>
        ) : (
          <div className="tarjeta hilo">{lista.map((n) => <TarjetaNota key={n.id} n={n} conContexto />)}</div>
        )}
      </Seccion>
    </>
  );
}
