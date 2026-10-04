import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useMyProfile } from "@/hooks/useArena";

/** Impede jogar antes de o perfil mínimo estar configurado. */
export function useProfileGate() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyProfile();

  const hasProfile = !!data?.profile;
  const ready = !!data?.profile?.username;

  useEffect(() => {
    // Ainda estamos a verificar o perfil.
    if (isLoading) return;

    // Se houve erro ao carregar o perfil, NÃO redirecionamos.
    // Evita criar um loop enquanto a sessão/API recupera.
    if (isError) return;

    // Só envia para configuração quando temos uma resposta válida
    // e sabemos que o perfil ainda não está configurado.
    if (data && !hasProfile) {
      navigate({
        to: "/configurar-perfil",
        replace: true,
      });
    }
  }, [isLoading, isError, data, hasProfile, navigate]);

  return {
    ready,
    isLoading,
    isError,
  };
}
