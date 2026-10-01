import { useState, type FormEvent } from "react";
import { supabase, type Miembro, type Rol } from "../supabase";
import { useDatos } from "../lib/datos";
import { Cargando, Falla, Seccion } from "../ui";

const ROLES: { valor: Rol; texto: string; que: string }[] = [
  { valor: "equipo", texto: "Equipo", que: "Ve cifras y resultados, sin nombres ni teléfonos de clientes" },
  { valor: "ventas", texto: "Ventas", que: "Ve todo, incluidos nombres y teléfonos de los leads" },
  { valor: "admin", texto: "Administración", que: "Ve todo, edita la estrategia y maneja el equipo" },
];

export default function Equipo({ miembro }: { miembro: Miembro }) {
  const { datos, error, cargando, recargar } = useDatos(() => supabase.from("equipo").select("email,nombre,rol").order("nombre"));
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("equipo");
  const [falla, setFalla] = useState<string | null>(null);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setFalla(null);
    const { error } = await supabase.from("equipo").insert({ email: email.trim().toLowerCase(), nombre: nombre.trim() || null, rol });
    if (error) return setFalla(error.code === "23505" ? "Ese correo ya está en el equipo." : error.message);
    setEmail(""); setNombre(""); setRol("equipo");
    recargar();
  }

  async function cambiarRol(m: Miembro, nuevo: Rol) {
    const { error } = await supabase.from("equipo").update({ rol: nuevo }).eq("email", m.email);
    if (error) setFalla(error.message);
    recargar();
  }

  async function quitar(m: Miembro) {
    if (!confirm(`¿Quitarle el acceso a ${m.nombre ?? m.email}?`)) return;
    const { error } = await supabase.from("equipo").delete().eq("email", m.email);
    if (error) setFalla(error.message);
    recargar();
  }

  return (
    <>
      <div className="titular">
        <p className="sobre">Solo administración</p>
        <h1>Quién entra a la app</h1>
        <p className="sub">Agrega el correo de la persona. Ella entra con ese correo y le llega un enlace, sin contraseña.</p>
      </div>

      <Seccion titulo="Agregar a alguien">
        <form className="tarjeta formulario" onSubmit={agregar}>
          <label>Correo<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" /></label>
          <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></label>
          <label>Qué puede ver
            <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
            </select>
          </label>
          <p className="sub">{ROLES.find((r) => r.valor === rol)?.que}</p>
          {falla && <p className="falla">{falla}</p>}
          <button className="boton">Agregar</button>
        </form>
      </Seccion>

      <Seccion titulo="El equipo" sub={`${(datos ?? []).length} personas con acceso`}>
        <Falla error={error} />
        {cargando ? <Cargando /> : (
          <div className="lista">
            {((datos ?? []) as Miembro[]).map((m) => (
              <div key={m.email} className="fila">
                <div className="crece">
                  <b>{m.nombre ?? m.email}</b>
                  <div className="sub">{m.email}</div>
                </div>
                {m.email === miembro.email ? <span className="insignia">Tú · Administración</span> : (
                  <>
                    <select value={m.rol} onChange={(e) => cambiarRol(m, e.target.value as Rol)} aria-label="Rol">
                      {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
                    </select>
                    <button className="enlace peligro" onClick={() => quitar(m)}>Quitar</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Seccion>
    </>
  );
}
