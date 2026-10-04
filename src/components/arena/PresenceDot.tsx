export type PresenceStatus = "online" | "in_game" | "offline";

export const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  online: "Online",
  in_game: "Em partida",
  offline: "Offline",
};

/** Considera-se ativo quem deu sinal nos últimos 70 segundos. */
export function resolvePresence(
  row: { status: string; last_seen_at: string } | undefined | null,
): PresenceStatus {
  if (!row) return "offline";
  const fresh = Date.now() - new Date(row.last_seen_at).getTime() < 70_000;
  if (!fresh) return "offline";
  return row.status === "in_game" ? "in_game" : row.status === "online" ? "online" : "offline";
}

export function PresenceDot({
  status,
  withLabel = false,
}: {
  status: PresenceStatus;
  withLabel?: boolean;
}) {
  const color =
    status === "online"
      ? "bg-success"
      : status === "in_game"
        ? "bg-warning"
        : "bg-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`size-2 rounded-full ${color}`} aria-hidden="true" />
      {withLabel && <span>{PRESENCE_LABEL[status]}</span>}
      <span className="sr-only">{PRESENCE_LABEL[status]}</span>
    </span>
  );
}
