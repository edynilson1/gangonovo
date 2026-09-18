import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

import { AppShell } from "@/components/arena/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard, useMyProfile } from "@/hooks/useArena";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking global — XP Arena" },
      { name: "description", content: "Top 25 jogadores por XP total e a tua posição atual." },
      { property: "og:title", content: "Ranking global — XP Arena" },
      { property: "og:description", content: "Vê quem lidera a XP Arena e onde estás." },
    ],
  }),
  component: RankingPage,
});

function RankingPage() {
  return (
    <AppShell>
      <RankingContent />
    </AppShell>
  );
}

function RankingContent() {
  const { data, isLoading, isError, refetch } = useLeaderboard();
  const me = useMyProfile();
  const inTop = data?.top.some((entry) => entry.id === data.myId);

  return (
    <div>
      <h1 className="text-2xl font-bold">Ranking global</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ordenado por XP total. Empates desempatam por vitórias e depois por quem chegou primeiro.
      </p>

      {isLoading ? (
        <div className="mt-5 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="arena-card mt-5 p-5 text-center text-sm">
          <p>Não foi possível carregar o ranking.</p>
          <button onClick={() => refetch()} className="mt-3 text-sm font-semibold text-primary">
            Tentar novamente
          </button>
        </div>
      ) : data && data.top.length > 0 ? (
        <>
          <ol className="arena-card mt-5 divide-y divide-border">
            {data.top.map((entry) => (
              <li
                key={entry.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  entry.id === data.myId ? "bg-surface-2" : ""
                }`}
              >
                <span
                  className={`w-7 text-sm font-bold ${
                    entry.rank <= 3 ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {entry.rank}
                </span>
                <img src={entry.avatar_url ?? ""} alt="" className="size-9 rounded-full bg-surface-2" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{entry.display_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{entry.username} · {entry.wins} vitórias
                  </span>
                </span>
                <span className="text-sm font-semibold">{entry.total_xp} XP</span>
              </li>
            ))}
          </ol>

          {!inTop && (
            <div className="arena-card mt-4 flex items-center gap-3 p-4">
              <span className="w-7 text-sm font-bold text-primary">
                {data.myRank ? `#${data.myRank}` : "—"}
              </span>
              <img
                src={me.data?.profile?.avatar_url ?? ""}
                alt=""
                className="size-9 rounded-full bg-surface-2"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {me.data?.profile?.display_name} (tu)
                </span>
                <span className="block text-xs text-muted-foreground">Fora do Top 25</span>
              </span>
              <span className="text-sm font-semibold">{me.data?.profile?.total_xp ?? 0} XP</span>
            </div>
          )}
        </>
      ) : (
        <p className="arena-card mt-5 flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Trophy className="size-4" aria-hidden="true" /> Ainda não há jogadores no ranking.
        </p>
      )}
    </div>
  );
}
