// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — Supabase Configuration
//  -----------------------------------------------------------------------
//  ⚠️  INSTRUCCIONES:
//  1. Crea un proyecto en https://supabase.com
//  2. Ve a Settings → API
//  3. Copia la "Project URL" y la "anon public" key
//  4. Reemplaza los PLACEHOLDERS de abajo
//  5. Ejecuta supabase/schema.sql en el SQL Editor del proyecto
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ──────────────────────────────────────────────────────────────────────
//  Configuración Supabase activa
// ──────────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://zokpdbogudfnvxfrayyv.supabase.co';
const SUPABASE_ANON = 'sb_publishable_hutUywsg8e97_GsJ5jBYPg_CagBNhAz';
// ──────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

export default supabase;
