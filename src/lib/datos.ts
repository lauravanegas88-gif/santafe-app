import { useCallback, useEffect, useState } from "react";

// Carga datos al abrir la pantalla y permite recargar después de guardar.
export function useDatos<T>(cargar: () => PromiseLike<{ data: T | null; error: { message: string } | null }>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await cargar();
    setDatos(data);
    setError(error?.message ?? null);
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { datos, error, cargando, recargar };
}
