# SantaFe · app del equipo

App web del equipo de Arrendamientos SantaFe: estrategia, contenido calificado, pauta y leads.

- Se publica sola en GitHub Pages con cada cambio en `main` (`.github/workflows/deploy.yml`).
- Los datos viven en Supabase, detrás del inicio de sesión. Este código no contiene cifras
  ni secretos: solo la llave pública de Supabase, y lo que cada persona ve lo decide la base
  de datos según su rol (`admin`, `ventas`, `equipo`).

```bash
npm install
npm run dev     # http://localhost:5173/santafe-app/
npm run build
```
