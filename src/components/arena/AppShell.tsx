import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { BottomNav } from "@/components/arena/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyProfile } from "@/hooks/useArena";

type Props = {
  children: ReactNode;
  /** Exige perfil mínimo configurado (username + nome de exibição). */
  requireProfile?: boolean;
  hideNav?: boolean;
};

export function AppShell({ children, requireProfile = true, hideNav = false }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useMyProfile();

  // ADICIONE ESTE LOG PARA VERMOS O QUE O SUPABASE ESTÁ A DEVOLVER:
  console.log("AppShell - Dados recebidos do perfil:", data);

  const profile = data?.profile;
  const hasUsername = Boolean(profile?.username);
  const needsSetup = requireProfile && !isLoading && !!data && !hasUsername;
  useEffect(() => {
    if (needsSetup) {
      navigate({ to: "/configurar-perfil", replace: true });
    }
  }, [needsSetup, navigate]);

  return (
    <div className="min-h-screen arena-hero">
      <main
        className={`mx-auto w-full max-w-md px-4 pt-6 ${hideNav ? "pb-8" : "arena-safe-bottom"}`}
      >
        {isLoading ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <div className="arena-card p-5 text-center">
            <p className="text-sm font-medium">Não foi possível carregar os teus dados.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(error as Error)?.message ?? "Verifica a ligação e tenta novamente."}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Tentar novamente
            </button>
          </div>
        ) : needsSetup ? (
          <div className="arena-card p-5 text-center text-sm text-muted-foreground">
            A preparar a configuração do teu perfil…
          </div>
        ) : (
          children
        )}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
