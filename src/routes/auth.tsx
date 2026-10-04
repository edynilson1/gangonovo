import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { Loader2, Mail, Phone } from "lucide-react";

import { type FormEvent, useEffect, useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      {
        title: "Entrar na XP Arena",
      },
      {
        name: "description",
        content: "Entra na XP Arena com Google, e-mail ou telefone.",
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

  /*
   * =====================================================
   * INICIALIZAÇÃO DA AUTENTICAÇÃO
   * =====================================================
   *
   * O Supabase possui:
   *
   * detectSessionInUrl: true
   *
   * Portanto, quando o Google voltar para:
   *
   * /auth#access_token=...
   *
   * o próprio Supabase processará o token.
   *
   * NÃO fazemos setSession manualmente.
   */

  useEffect(() => {
    let mounted = true;

    async function checkExistingSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Erro ao verificar sessão:", error);

          return;
        }

        if (mounted && data.session) {
          navigate({
            to: "/inicio",
            replace: true,
          });
        }
      } catch (error) {
        console.error("Erro inesperado ao verificar sessão:", error);
      }
    }

    checkExistingSession();

    /*
     * Escuta alterações da autenticação.
     *
     * Quando o Google terminar o login,
     * o Supabase dispara SIGNED_IN.
     */

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Supabase Auth]", event, session ? "sessão encontrada" : "sem sessão");

      if (!mounted || !session) {
        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        navigate({
          to: "/inicio",
          replace: true,
        });
      }
    });

    return () => {
      mounted = false;

      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  /*
   * =====================================================
   * GOOGLE
   * =====================================================
   */

  async function handleGoogle() {
    setLoading("google");

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",

        options: {
          /*
           * O Google volta para /auth.
           *
           * O Supabase processa automaticamente
           * o access_token através de
           * detectSessionInUrl.
           */

          redirectTo: `${window.location.origin}/auth`,
        },
      });

      console.log("Google OAuth iniciado:", data);

      if (error) {
        console.error("Erro Google OAuth:", error);

        toast.error("Erro ao entrar com Google: " + error.message);

        setLoading(null);
      }

      /*
       * NÃO fazemos:
       *
       * supabase.auth.setSession(...)
       *
       * aqui.
       *
       * O Supabase trata o retorno.
       */
    } catch (error) {
      console.error("Erro inesperado no Google OAuth:", error);

      toast.error("Ocorreu um erro ao conectar com o Google.");

      setLoading(null);
    }
  }

  /*
   * =====================================================
   * E-MAIL
   * =====================================================
   */

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading("email");

    try {
      /*
       * REGISTRO
       */

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),

          password,

          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });

        if (error) {
          console.error("Erro ao criar conta:", error);

          toast.error(error.message);

          return;
        }

        /*
         * Se a confirmação por e-mail estiver
         * ativada no Supabase, session será null.
         */

        if (!data.session) {
          toast.success("Conta criada! Verifica o teu e-mail para confirmar a conta.");

          return;
        }

        navigate({
          to: "/inicio",
          replace: true,
        });

        return;
      }

      /*
       * LOGIN
       */

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),

        password,
      });

      if (error) {
        console.error("Erro ao entrar:", error);

        toast.error("Não foi possível entrar: " + error.message);

        return;
      }

      navigate({
        to: "/inicio",
        replace: true,
      });
    } catch (error) {
      console.error("Erro inesperado no login:", error);

      toast.error("Ocorreu um erro ao processar o login.");
    } finally {
      setLoading(null);
    }
  }

  /*
   * =====================================================
   * TELEFONE / OTP
   * =====================================================
   */

  async function handlePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading("phone");

    try {
      /*
       * PRIMEIRO PASSO:
       * enviar código
       */

      if (!otpSent) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: phone.trim(),
        });

        if (error) {
          console.error("Erro ao enviar SMS:", error);

          toast.error("Não foi possível enviar o código: " + error.message);

          return;
        }

        setOtpSent(true);

        toast.success("Código enviado por SMS.");

        return;
      }

      /*
       * SEGUNDO PASSO:
       * confirmar código
       */

      const { error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),

        token: otp.trim(),

        type: "sms",
      });

      if (error) {
        console.error("Erro ao confirmar código:", error);

        toast.error("Código inválido ou expirado.");

        return;
      }

      navigate({
        to: "/inicio",
        replace: true,
      });
    } catch (error) {
      console.error("Erro inesperado no telefone:", error);

      toast.error("Ocorreu um erro no login por telefone.");
    } finally {
      setLoading(null);
    }
  }

  /*
   * =====================================================
   * INTERFACE
   * =====================================================
   */

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
          <h1 className="text-xl font-bold">{mode === "signup" ? "Criar conta" : "Entrar"}</h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Cria a tua conta para jogar e ganhar XP."
              : "Bem-vindo de volta à XP Arena."}
          </p>

          {/* GOOGLE */}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading !== null}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 text-sm font-semibold transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
            Continuar com Google
          </button>

          {/* DIVISOR */}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* TABS */}

          <Tabs defaultValue="email">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">
                <Mail className="mr-1.5 size-4" />
                E-mail
              </TabsTrigger>

              <TabsTrigger value="phone">
                <Phone className="mr-1.5 size-4" />
                Telefone
              </TabsTrigger>
            </TabsList>

            {/* E-MAIL */}

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
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu@exemplo.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Palavra-passe</Label>

                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={6}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <Button type="submit" className="h-11 w-full" disabled={loading !== null}>
                  {loading === "email" && <Loader2 className="mr-2 size-4 animate-spin" />}

                  {mode === "signup" ? "Criar conta" : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            {/* TELEFONE */}

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
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+258840000000"
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
                      onChange={(event) => setOtp(event.target.value)}
                      placeholder="000000"
                    />
                  </div>
                )}

                <Button type="submit" className="h-11 w-full" disabled={loading !== null}>
                  {loading === "phone" && <Loader2 className="mr-2 size-4 animate-spin" />}

                  {otpSent ? "Confirmar código" : "Receber código"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* ALTERAR MODO */}

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

/*
 * =====================================================
 * GOOGLE ICON
 * =====================================================
 */

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
