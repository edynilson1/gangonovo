import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar na XP Arena" },
      {
        name: "description",
        content: "Cria a tua conta na XP Arena com Google, e-mail ou telefone e começa a ganhar XP.",
      },
      { property: "og:title", content: "Entrar na XP Arena" },
      {
        property: "og:description",
        content: "Acede à tua conta XP Arena e continua a subir no ranking global.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [loading, setLoading] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  async function handleGoogle() {
    setLoading("google");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Não foi possível entrar com Google.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/inicio", replace: true });
    } finally {
      setLoading(null);
    }
  }

  async function handleEmail(event: React.FormEvent) {
    event.preventDefault();
    setLoading("email");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data.session) {
          toast.success("Conta criada! Confirma o teu e-mail para entrar.");
          return;
        }
        navigate({ to: "/configurar-perfil", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error("E-mail ou palavra-passe inválidos.");
          return;
        }
        navigate({ to: "/inicio", replace: true });
      }
    } finally {
      setLoading(null);
    }
  }

  async function handlePhone(event: React.FormEvent) {
    event.preventDefault();
    setLoading("phone");
    try {
      if (!otpSent) {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) {
          toast.error("Login por telefone indisponível: falta configurar o envio de SMS.");
          return;
        }
        setOtpSent(true);
        toast.success("Código enviado por SMS.");
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (error) {
        toast.error("Código inválido ou expirado.");
        return;
      }
      navigate({ to: "/inicio", replace: true });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="arena-hero flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2">
          <span className="arena-gradient arena-glow grid size-10 place-items-center rounded-xl font-bold">
            XP
          </span>
          <span className="text-lg font-semibold">XP Arena</span>
        </Link>

        <div className="arena-card mt-6 p-5">
          <h1 className="text-xl font-bold">
            {mode === "signup" ? "Criar conta" : "Entrar"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Cria a tua conta para guardar XP e ranking."
              : "Bem-vindo de volta à arena."}
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading !== null}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
          >
            {loading === "google" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <GoogleMark />
            )}
            Continuar com Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="email">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">
                <Mail className="mr-1.5 size-4" aria-hidden="true" /> E-mail
              </TabsTrigger>
              <TabsTrigger value="phone">
                <Phone className="mr-1.5 size-4" aria-hidden="true" /> Telefone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-4">
              <form onSubmit={handleEmail} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@exemplo.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Palavra-passe</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading !== null}>
                  {loading === "email" && (
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  )}
                  {mode === "signup" ? "Criar conta" : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="phone" className="mt-4">
              <form onSubmit={handlePhone} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Número de telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+244900000000"
                  />
                </div>
                {otpSent && (
                  <div className="space-y-1.5">
                    <Label htmlFor="otp">Código recebido</Label>
                    <Input
                      id="otp"
                      inputMode="numeric"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="000000"
                    />
                  </div>
                )}
                <Button type="submit" className="h-11 w-full" disabled={loading !== null}>
                  {loading === "phone" && (
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  )}
                  {otpSent ? "Confirmar código" : "Receber código"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  O login por telefone precisa de um serviço de SMS configurado no painel de contas.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Já tens conta?" : "Ainda não tens conta?"}{" "}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Entrar" : "Criar conta"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"
      />
    </svg>
  );
}
