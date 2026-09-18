import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";

import { AppShell } from "@/components/arena/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyHistory, useMyProfile } from "@/hooks/useArena";
import { supabase } from "@/integrations/supabase/client";
import { xpLevel } from "@/lib/xp-rules";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — XP Arena" },
      { name: "description", content: "O teu perfil, estatísticas e histórico de partidas." },
      { property: "og:title", content: "Perfil — XP Arena" },
      { property: "og:description", content: "Estatísticas, XP e histórico das tuas partidas." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <AppShell>
      <ProfileContent />
    </AppShell>
  );
}

const GAME_LABELS: Record<string, string> = {
  memoria: "Memória",
  quiz: "Quiz",
  damas: "Damas",
};

function ProfileContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useMyProfile();
  const history = useMyHistory();
  const profile = data?.profile;
  const level = xpLevel(profile?.total_xp ?? 0);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-6">
      <header className="arena-card flex items-center gap-4 p-5">
        <img src={profile?.avatar_url ?? ""} alt="" className="size-16 rounded-full bg-surface-2" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{profile?.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">@{profile?.username}</p>
          <p className="mt-1 text-xs text-muted-foreground">Nível {level.level}</p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "XP total", value: profile?.total_xp ?? 0 },
          { label: "Vitórias", value: profile?.wins ?? 0 },
          { label: "Ranking", value: data?.rank ? `#${data.rank}` : "—" },
        ].map((stat) => (
          <div key={stat.label} className="arena-card p-3 text-center">
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <Link
        to="/configurar-perfil"
        className="arena-card flex items-center gap-3 p-4 text-sm font-medium"
      >
        <Settings className="size-4 text-primary" aria-hidden="true" />
        Editar avatar e nomes
      </Link>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico de partidas
        </h2>
        {history.isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : history.data?.sessions.length ? (
          <ul className="arena-card divide-y divide-border">
            {history.data.sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between px-4 py-3">
                <span>
                  <span className="block text-sm font-medium">
                    {GAME_LABELS[session.game_type] ?? session.game_type}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(session.created_at).toLocaleString("pt-PT")} · {session.duration}s
                  </span>
                </span>
                <span className="text-sm font-semibold text-primary">+{session.xp_earned} XP</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="arena-card p-4 text-sm text-muted-foreground">
            Sem partidas registadas por enquanto.
          </p>
        )}
      </section>

      <Button variant="outline" className="h-11 w-full" onClick={handleSignOut}>
        <LogOut className="mr-2 size-4" aria-hidden="true" />
        Terminar sessão
      </Button>
    </div>
  );
}
