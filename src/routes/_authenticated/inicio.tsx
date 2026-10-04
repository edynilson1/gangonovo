import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Crown, HelpCircle, Trophy } from "lucide-react";

import { AppShell } from "@/components/arena/AppShell";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard, useMyProfile } from "@/hooks/useArena";
import { xpLevel } from "@/lib/xp-rules";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — XP Arena" },
      {
        name: "description",
        content: "O teu XP, posição no ranking e acesso rápido aos minijogos.",
      },
      { property: "og:title", content: "Início — XP Arena" },
      { property: "og:description", content: "Acompanha o teu XP e escolhe o próximo jogo." },
    ],
  }),
  component: HomePage,
});

const GAMES = [
  {
    to: "/memoria",
    title: "Jogo da Memória",
    desc: "Encontra os pares mais rápido",
    icon: Brain,
  },
  { to: "/quiz", title: "Quiz", desc: "10 perguntas cronometradas", icon: HelpCircle },
  { to: "/damas", title: "Damas", desc: "Contra o computador", icon: Crown },
] as const;

function HomePage() {
  return (
    <AppShell>
      <HomeContent />
    </AppShell>
  );
}

function HomeContent() {
  const { data } = useMyProfile();
  const leaderboard = useLeaderboard();
  const profile = data?.profile;
  const level = xpLevel(profile?.total_xp ?? 0);

  return (
    <div className="space-y-6">
      <header className="arena-card flex items-center gap-3 p-4">
        <img src={profile?.avatar_url ?? ""} alt="" className="size-14 rounded-full bg-surface-2" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{profile?.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">@{profile?.username}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Ranking</p>
          <p className="text-lg font-bold text-primary">{data?.rank ? `#${data.rank}` : "—"}</p>
        </div>
      </header>

      <section className="arena-card p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">XP total</p>
            <p className="text-3xl font-bold">{profile?.total_xp ?? 0}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Nível {level.level}</p>
            <p className="text-xs text-muted-foreground">
              {level.current}/{level.needed} XP
            </p>
          </div>
        </div>
        <Progress value={(level.current / level.needed) * 100} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {profile?.wins ?? 0} vitórias registadas
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Jogar agora
        </h2>
        <div className="grid gap-3">
          {GAMES.map(({ to, title, desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="arena-card flex items-center gap-3 p-4 active:scale-[0.99]"
            >
              <span className="arena-gradient grid size-11 place-items-center rounded-xl">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </span>
              <span className="text-xs font-semibold text-primary">Jogar</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          XP recente
        </h2>
        {data?.recentXp.length ? (
          <ul className="arena-card divide-y divide-border">
            {data.recentXp.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm capitalize">{tx.source}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString("pt-PT")}
                  </span>
                  <span className="text-sm font-semibold text-primary">+{tx.amount} XP</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="arena-card p-4 text-sm text-muted-foreground">
            Ainda não ganhaste XP. Joga uma partida para começar!
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top 25 global
          </h2>
          <Link to="/ranking" className="text-xs font-semibold text-primary">
            Ver tudo
          </Link>
        </div>
        {leaderboard.isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : leaderboard.data?.top.length ? (
          <ul className="arena-card divide-y divide-border">
            {leaderboard.data.top.slice(0, 5).map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-sm font-bold text-muted-foreground">{entry.rank}</span>
                <img
                  src={entry.avatar_url ?? ""}
                  alt=""
                  className="size-8 rounded-full bg-surface-2"
                />
                <span className="min-w-0 flex-1 truncate text-sm">{entry.display_name}</span>
                <span className="text-sm font-semibold">{entry.total_xp} XP</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="arena-card flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Trophy className="size-4" aria-hidden="true" /> O ranking ainda está vazio. Podes ser o
            primeiro.
          </p>
        )}
      </section>
    </div>
  );
}
