import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Crown, HelpCircle } from "lucide-react";

import { AppShell } from "@/components/arena/AppShell";

export const Route = createFileRoute("/_authenticated/jogos")({
  head: () => ({
    meta: [
      { title: "Jogos — XP Arena" },
      { name: "description", content: "Memória, Quiz e Damas: escolhe o minijogo e ganha XP." },
      { property: "og:title", content: "Jogos — XP Arena" },
      { property: "og:description", content: "Todos os minijogos da XP Arena num só lugar." },
    ],
  }),
  component: GamesPage,
});

const GAMES = [
  {
    to: "/memoria",
    title: "Jogo da Memória",
    desc: "Pares por categoria, com tempo e precisão a contar para o XP.",
    icon: Brain,
    tag: "Até 180 XP",
  },
  {
    to: "/quiz",
    title: "Quiz",
    desc: "10 perguntas, tempo por pergunta e bónus por sequência de acertos.",
    icon: HelpCircle,
    tag: "Até 200 XP",
  },
  {
    to: "/damas",
    title: "Damas",
    desc: "Tabuleiro 8x8 contra o computador, com três dificuldades.",
    icon: Crown,
    tag: "Até 150 XP",
  },
] as const;

function GamesPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Jogos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada partida gera XP calculado no servidor pelo teu desempenho.
      </p>
      <div className="mt-5 grid gap-3">
        {GAMES.map(({ to, title, desc, icon: Icon, tag }) => (
          <Link key={to} to={to} className="arena-card p-4 active:scale-[0.99]">
            <div className="flex items-center gap-3">
              <span className="arena-gradient grid size-11 place-items-center rounded-xl">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">{tag}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{desc}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
