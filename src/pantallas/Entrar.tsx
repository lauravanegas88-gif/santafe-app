import { useState, type FormEvent } from "react";
import { supabase } from "../supabase";
import { Logo } from "../ui";

export default function Entrar() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviado" | "error">("listo");
  const [mensaje, setMensaje] = useState("");

  // Si el enlace venció o ya se usó, Supabase vuelve con el error en la dirección.
  const errorEnlace = /error_description=([^&]+)/.exec(window.location.hash)?.[1];

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setEstado("error");
      setMensaje(error.message.includes("rate") ? "Se pidieron muchos enlaces seguidos. Espera unos minutos y vuelve a intentar." : error.message);
    } else {
      setEstado("enviado");
    }
  }

  return (
    <div className="entrar">
      <div className="entrar-caja">
        <div className="marca grande"><Logo /></div>
        <h1>La estrategia del equipo, en un solo lugar</h1>
        {estado === "enviado" ? (
          <>
            <p className="ok">Te enviamos un enlace a <b>{email}</b>.</p>
            <p>Ábrelo desde este mismo dispositivo para entrar. Si no llega en 2 minutos, revisa la carpeta de spam.</p>
            <button className="boton secundario" onClick={() => setEstado("listo")}>Usar otro correo</button>
          </>
        ) : (
          <form onSubmit={enviar}>
            <label htmlFor="email">Tu correo</label>
            <input id="email" type="email" required autoComplete="email" inputMode="email"
              placeholder="nombre@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="boton" disabled={estado === "enviando"}>
              {estado === "enviando" ? "Enviando…" : "Enviarme el enlace para entrar"}
            </button>
            {estado === "error" && <p className="falla">{mensaje}</p>}
            {errorEnlace && estado === "listo" && (
              <p className="falla">El enlace ya no sirve (venció o ya se usó). Pide uno nuevo.</p>
            )}
            <p className="sub">Sin contraseña: cada vez que entres te llega un enlace al correo.</p>
          </form>
        )}
      </div>
    </div>
  );
}
