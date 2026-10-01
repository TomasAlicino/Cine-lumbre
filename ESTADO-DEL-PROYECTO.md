# Estado del proyecto

## Hecho
- Toda la aplicación (público, compra, cuenta, empleados, admin) — compila con `npm run build`.
- Rutas del admin con layout y menú lateral (`features/admin/admin.routes.ts`).
- Área de empleados como NgModule (`features/staff/staff.module.ts`).
- Semilla `public/data/seed.json` + pósters SVG en `public/posters/`.
- Integración con Supabase: `SupabaseService`, `DbService` (datos + Realtime), `AuthService` (Supabase Auth).
- `docs/REQUERIMIENTOS.md`, `docs/supabase.sql`, `README.md`, `firebase.json`.

## Pendiente (manual)
1. Supabase: correr `docs/supabase.sql`, desactivar "Confirm email" y poner la
   **publishable key** en `src/environments/environment.ts` (la URL ya está cargada).
2. Firebase: `firebase init hosting` + `npm run build` + `firebase deploy`, y poner la URL en el README.
3. Subir a GitHub.
