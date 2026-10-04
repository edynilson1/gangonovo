// src/integrations/supabase/client.ts

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"];
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env["VITE_SUPABASE_ANON_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!SUPABASE_URL) {
  throw new Error("Missing VITE_SUPABASE_URL environment variable.");
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY environment variable.",
  );
}

/*
 * Cliente oficial do Supabase.
 *
 * NÃO colocar sessão falsa aqui.
 * NÃO colocar mock-token.
 * NÃO escrever manualmente no localStorage.
 *
 * O Supabase será responsável por:
 * - guardar a sessão;
 * - renovar o token;
 * - processar o retorno OAuth;
 * - restaurar a sessão quando a página abrir.
 */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,

    autoRefreshToken: true,

    detectSessionInUrl: true,

    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
