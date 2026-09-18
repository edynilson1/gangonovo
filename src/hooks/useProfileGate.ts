import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useMyProfile } from "@/hooks/useArena";

/** Impede jogar antes de o perfil mínimo estar configurado. */
export function useProfileGate() {
  const navigate = useNavigate();
  const { data, isLoading } = useMyProfile();
  const ready = !!data?.profile?.username;

  useEffect(() => {
    if (!isLoading && data && !ready) navigate({ to: "/configurar-perfil", replace: true });
  }, [isLoading, data, ready, navigate]);

  return { ready, isLoading };
}
