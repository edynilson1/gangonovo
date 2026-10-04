import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  /*
   * O projeto está sendo executado no navegador.
   * A autenticação do Supabase também é feita no navegador.
   */
  ssr: false,

  /*
   * Guarda todas as rotas dentro de
   * /_authenticated.
   */
  beforeLoad: async () => {
    // eslint-disable-next-line no-useless-catch
    try {
      /*
       * Primeiro recuperamos a sessão existente.
       *
       * Isso funciona para:
       *
       * - login Google
       * - login e-mail
       * - login telefone
       * - sessão já salva no navegador
       * - refresh da página
       */

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      /*
       * Não existe sessão.
       */

      if (sessionError || !sessionData.session) {
        throw redirect({
          to: "/auth",
        });
      }

      /*
       * Depois confirmamos o utilizador
       * diretamente no Supabase.
       */

      const { data: userData, error: userError } = await supabase.auth.getUser();

      /*
       * Sessão inválida ou utilizador inexistente.
       */

      if (userError || !userData.user) {
        throw redirect({
          to: "/auth",
        });
      }

      /*
       * Disponibilizamos o utilizador
       * para as páginas autenticadas.
       */

      return {
        user: userData.user,
      };
    } catch (error) {
      /*
       * IMPORTANTE:
       *
       * Se o erro já for um redirect do
       * TanStack Router, precisamos deixá-lo
       * continuar.
       */

      throw error;
    }
  },

  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return <Outlet />;
}
