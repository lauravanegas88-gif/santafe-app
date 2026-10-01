import { createClient } from "@supabase/supabase-js";

// Llave pública (publishable): puede ir en el código. Lo que cada persona ve lo decide
// la base de datos según su rol en la tabla `equipo`. El token de Meta nunca va aquí.
const URL = "https://fhuztrgtkqwlbrxjrrlq.supabase.co";
const LLAVE_PUBLICA = "sb_publishable_PWfNY1vrENltPch8FK06Bg_D0I4uP65";

export const supabase = createClient(URL, LLAVE_PUBLICA, {
  auth: {
    // "implicit" deja entrar aunque el correo se abra en otro navegador o en el celular.
    flowType: "implicit",
    detectSessionInUrl: true,
    persistSession: true,
  },
});

export type Rol = "admin" | "ventas" | "equipo";
export type Miembro = { email: string; nombre: string | null; rol: Rol };
