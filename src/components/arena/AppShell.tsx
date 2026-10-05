import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { BottomNav } from "@/components/arena/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyProfile } from "@/hooks/useArena";

type Props = {
  children: ReactNode;
  requireProfile?: boolean;
  hideNav?: boolean;
};

export function AppShell({
  children,
  requireProfile = true,
  hideNav = false,
}: Props) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useMyProfile();

  const profile = data?.profile;

  const hasUsername = Boolean(profile?.username?.trim());

  const needsSetup =
    requireProfile &&
    !isLoading &&
    !isError &&
    data !== undefined &&
    profile === null;

  useEffect(() => {
    if (needsSetup) {
      navigate({
        to: "/configurar-perfil",
        replace: true,
      });
    }
  }, [needsSetup, navigate]);

  return (
    <div className="min-h-screen arena-hero">
      <main
        className={`mx-auto w-full max-w-md px-4 pt-6 ${
          hideNav ? "pb-8" : "arena-safe-bottom"
        }`}
      >
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : isError ? (
          <div className="arena-card p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar o teu perfil.
            </p>

            {error instanceof Error && (
              <p className="mt-2 text-xs text-muted-foreground">
                {error.message}
              </p>
            )}

            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
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