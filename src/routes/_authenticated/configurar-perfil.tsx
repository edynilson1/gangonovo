import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyProfile } from "@/hooks/useArena";
import { saveProfile } from "@/lib/arena.functions";
import { AVATAR_PRESETS } from "@/lib/avatars";

export const Route = createFileRoute("/_authenticated/configurar-perfil")({
  head: () => ({
    meta: [
      { title: "Configurar perfil — XP Arena" },
      {
        name: "description",
        content: "Escolhe o teu avatar, nome de utilizador e nome de exibição.",
      },
      { property: "og:title", content: "Configurar perfil — XP Arena" },
      {
        property: "og:description",
        content: "Define o teu perfil antes de entrar na arena.",
      },
    ],
  }),
  component: ProfileSetup,
});

function ProfileSetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useMyProfile();

  const [avatar, setAvatar] = useState(AVATAR_PRESETS[0]!);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  /*
   * IMPORTANTE:
   *
   * Não redirecionamos automaticamente quando encontramos username.
   *
   * Antes isso podia criar um ciclo:
   *
   * configurar-perfil
   *      ↓
   * username encontrado
   *      ↓
   * /inicio
   *      ↓
   * outra verificação
   *      ↓
   * configurar-perfil
   *
   * O utilizador deve poder abrir esta página para editar o perfil.
   */

  useEffect(() => {
    if (!data?.profile) return;

    if (data.profile.avatar_url) {
      setAvatar(data.profile.avatar_url);
    }

    if (data.profile.username) {
      setUsername(data.profile.username);
    }

    if (data.profile.display_name) {
      setDisplayName(data.profile.display_name);
    }
  }, [data]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);

    try {
      const normalizedUsername = username.trim().toLowerCase();
      const normalizedDisplayName = displayName.trim();

      /*
       * 1. Guarda realmente no Supabase.
       */
      await saveProfile({
        data: {
          username: normalizedUsername,
          displayName: normalizedDisplayName,
          avatarUrl: avatar,
        },
      });

      /*
       * 2. Busca novamente os dados diretamente do servidor.
       *
       * Isto é mais seguro do que construir manualmente
       * um objeto de perfil no frontend.
       */
      const freshProfile = await refetch();

      /*
       * 3. Atualiza a cache com os dados realmente devolvidos
       * pelo backend.
       */
      if (freshProfile.data) {
        queryClient.setQueryData(["arena", "me"], freshProfile.data);
      }

      /*
       * 4. Só agora navegamos para o início.
       */
      toast.success("Perfil pronto! Bem-vindo à arena.");

      await navigate({
        to: "/inicio",
        replace: true,
      });
    } catch (error: unknown) {
      console.error("Erro ao guardar perfil:", error);

      const message = error instanceof Error ? error.message : "Não foi possível guardar o perfil.";

      toast.error(message);

      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="arena-hero flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="arena-hero min-h-screen px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold">Configura o teu perfil</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Precisas de um avatar, nome de utilizador e nome de exibição antes de jogar.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="arena-card p-4">
            <div className="flex items-center gap-4">
              <img
                src={avatar}
                alt="Avatar selecionado"
                className="size-16 rounded-full bg-surface-2"
              />

              <div>
                <p className="text-sm font-semibold">Escolhe o teu avatar</p>

                <p className="text-xs text-muted-foreground">Podes mudar depois no perfil.</p>
              </div>
            </div>

            <div
              role="radiogroup"
              aria-label="Avatares disponíveis"
              className="mt-4 grid grid-cols-6 gap-2"
            >
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  role="radio"
                  aria-checked={avatar === preset}
                  aria-label="Avatar"
                  onClick={() => setAvatar(preset)}
                  className={`relative aspect-square rounded-full bg-surface-2 p-1 transition-transform hover:scale-105 ${
                    avatar === preset ? "ring-2 ring-primary" : "ring-1 ring-border"
                  }`}
                >
                  <img src={preset} alt="" className="size-full rounded-full" />

                  {avatar === preset && (
                    <Check className="absolute -right-1 -top-1 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Nome de utilizador (único)</Label>

            <Input
              id="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="ex: jogador_pro"
              maxLength={16}
            />

            <p className="text-xs text-muted-foreground">3 a 16 caracteres: letras, números ou _</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayName">Nome de exibição</Label>

            <Input
              id="displayName"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ex: Rúben M."
              maxLength={24}
            />
          </div>

          <Button type="submit" className="h-12 w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}

            {saving ? "A guardar..." : "Guardar e entrar na arena"}
          </Button>
        </form>
      </div>
    </div>
  );
}
