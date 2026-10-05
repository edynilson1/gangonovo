import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyProfile } from "@/hooks/useArena";
import { saveProfile, uploadProfileAvatar } from "@/lib/arena.functions";
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

  const { data, isLoading } = useMyProfile();

  const [avatar, setAvatar] = useState(AVATAR_PRESETS[0]!);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
      setAvatarFile(null);
    }

    if (data.profile.username) {
      setUsername(data.profile.username);
    }

    if (data.profile.display_name) {
      setDisplayName(data.profile.display_name);
    }
  }, [data]);

  useEffect(
    () => () => {
      if (avatar.startsWith("blob:")) URL.revokeObjectURL(avatar);
    },
    [avatar],
  );

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Escolhe uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2 MB.");
      return;
    }

    setAvatarFile(file);
    setAvatar(URL.createObjectURL(file));
  }

  function fileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Não foi possível ler a imagem selecionada."));
      };
      reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);

    try {
      const normalizedUsername = username.trim().toLowerCase();
      const normalizedDisplayName = displayName.trim();

      await queryClient.cancelQueries({ queryKey: ["arena", "me"] });
      const uploadedAvatar = avatarFile
        ? await uploadProfileAvatar({ data: { image: await fileAsDataUrl(avatarFile) } })
        : null;

      const savedProfile = await saveProfile({
        data: {
          username: normalizedUsername,
          displayName: normalizedDisplayName,
          avatarUrl: uploadedAvatar?.avatarUrl ?? avatar,
        },
      });

      queryClient.setQueryData(["arena", "me"], {
        profile: savedProfile.profile,
        rank: data?.rank ?? null,
        recentXp: data?.recentXp ?? [],
      });

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
        <div className="mb-4 flex items-center gap-2">
          <Link
            to="/inicio"
            aria-label="Voltar ao início"
            className="rounded-lg p-2 hover:bg-surface-2"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <h1 className="text-2xl font-bold">Configura o teu perfil</h1>
        </div>

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

                <p className="text-xs text-muted-foreground">
                  Escolhe da galeria ou usa um avatar pronto. JPG, PNG ou WebP, até 2 MB.
                </p>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label="Escolher imagem da galeria"
                  onChange={handleAvatarChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-9"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <ImagePlus className="mr-2 size-4" aria-hidden="true" />
                  Escolher da galeria
                </Button>
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
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatar(preset);
                  }}
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
