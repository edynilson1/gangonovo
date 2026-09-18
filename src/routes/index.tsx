import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Brain, Crown, Gamepad2, Sparkles } from "lucide-react";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XP Arena — Minijogos, XP e ranking global" },
      {
        name: "description",
        content:
          "Joga Memória, Quiz e Damas, ganha XP em cada partida e sobe no ranking global do Top 25.",
      },
      { property: "og:title", content: "XP Arena — Minijogos, XP e ranking global" },
      {
        property: "og:description",
        content: "Minijogos rápidos com XP persistente e ranking global. Entra e começa a subir.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  return (
    <div className="arena-hero min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-5 py-10">
        <header className="flex items-center gap-2">
          <span className="arena-gradient arena-glow grid size-10 place-items-center rounded-xl font-bold">
            XP
          </span>
          <span className="text-lg font-semibold">XP Arena</span>
        </header>

        <section className="py-10">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" /> XP real, ranking global
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            Joga rápido.
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Sobe no ranking.
            </span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Três minijogos, XP ganho em cada partida e um Top 25 global que atualiza a cada vitória.
          </p>

          <ul className="mt-8 grid gap-3">
            {[
              { icon: Brain, title: "Jogo da Memória", desc: "Frutas, animais e mais categorias" },
              { icon: Gamepad2, title: "Quiz", desc: "10 perguntas cronometradas" },
              { icon: Crown, title: "Damas", desc: "Contra o computador, 3 níveis" },
            ].map(({ icon: Icon, title, desc }) => (
              <li key={title} className="arena-card flex items-center gap-3 p-4">
                <span className="grid size-10 place-items-center rounded-lg bg-surface-2 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-3">
          <Link
            to="/auth"
            className="arena-gradient arena-glow flex h-12 items-center justify-center rounded-xl text-sm font-semibold"
          >
            Criar conta ou entrar
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Entra com Google, e-mail ou telefone.
          </p>
        </div>
      </div>
    </div>
  );
}
