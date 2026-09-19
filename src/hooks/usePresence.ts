import { useEffect } from "react";

import { setPresence } from "@/lib/online.functions";

/**
 * Mantém o estado de presença do utilizador atualizado (batida a cada 30s).
 * Enquanto a aba estiver aberta e ativa o jogador nunca aparece offline.
 */
export function usePresence(status: "online" | "in_game" = "online") {
  useEffect(() => {
    let cancelled = false;

    const beat = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void setPresence({ data: { status } }).catch(() => undefined);
    };

    beat();
    const interval = setInterval(beat, 30_000);
    document.addEventListener("visibilitychange", beat);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [status]);
}
