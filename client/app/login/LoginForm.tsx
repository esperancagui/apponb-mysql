"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, PlayCircle } from "lucide-react";
import Logo from "@/app/components/Logo";
import { useAuth } from "@/app/contexts";
import { reactivateAccount } from "@/app/lib/services/userService";
import { toast } from "sonner";

export default function LoginForm() {
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Reactivation state
  const [showReactivate, setShowReactivate] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [reactivationMode, setReactivationMode] = useState<"email" | "google">("email");

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = emailRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";
    setIsLoading(true);
    try {
      const result = await signIn(email, password);
      if (result === "account-disabled") {
        setPendingEmail(email);
        setPendingPassword(password);
        setShowReactivate(true);
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ocorreu um erro.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivate = async () => {
    setIsReactivating(true);
    try {
      await reactivateAccount(pendingEmail);
      toast.success("Conta reativada com sucesso!");
      if (reactivationMode === "google") {
        // signInWithPopup requires a direct user gesture — calling it here (after
        // an async network request) would be blocked by the browser. Close the
        // dialog and let the user click "Continuar com o Google" again.
        setShowReactivate(false);
        toast.info("Conta reativada! Clique em 'Continuar com o Google' para entrar.");
      } else {
        const result = await signIn(pendingEmail, pendingPassword);
        if (result === "ok") {
          setShowReactivate(false);
          router.push("/dashboard");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reativar conta.");
    } finally {
      setIsReactivating(false);
    }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (Array.isArray(result)) {
        const [, email] = result;
        setPendingEmail(email);
        setReactivationMode("google");
        setShowReactivate(true);
      } else if (result === "popup-closed") {
        // Silent — user just closed the popup, no need to redirect or show error
        return;
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocorreu um erro.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-zinc-950 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800">
      <div className="w-full max-w-[380px] px-8 py-10">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <Link href="/" className="inline-block transition-transform hover:scale-105 active:scale-95 duration-200">
            <div className="w-24 h-10 flex items-center justify-center">
              <Logo className="w-full h-full text-primary fill-current drop-shadow-sm" />
            </div>
          </Link>
        </div>

        <div className="space-y-4">
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Insira seus dados para acessar seu workspace.</p>
          </div>

          <div className="space-y-4">
            <Button
              variant="outline"
              type="button"
              disabled={isGoogleLoading || isLoading}
              onClick={handleGoogle}
              className="w-full h-11 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-medium transition-colors rounded-xl flex items-center justify-center gap-2 shadow-sm"
            >
              {isGoogleLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Continuar com o Google
            </Button>
          </div>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-zinc-950 px-3 text-zinc-400 font-medium tracking-widest">Ou</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 shadow-sm focus-within:ring-2 focus-within:ring-zinc-200 dark:focus-within:ring-zinc-800 transition-all">
              <div className="relative border-b border-zinc-200 dark:border-zinc-800">
                <Input
                  ref={emailRef}
                  id="email"
                  type="email"
                  placeholder="Email"
                  required
                  disabled={isLoading}
                  className="h-12 border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 placeholder:text-zinc-400 text-[15px]"
                />
              </div>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  required
                  disabled={isLoading}
                  className="h-12 border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 pr-12 placeholder:text-zinc-400 text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Link
                href="/forgot-password"
                className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl transition-all mt-2 shadow-sm active:scale-[0.98] text-[15px] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500 pt-6">
            Não tem uma conta?{" "}
            <Link
              href="/register"
              className="font-medium text-black dark:text-white hover:underline underline-offset-4"
            >
              Criar conta
            </Link>
          </p>
        </div>
      </div>

      {/* ─── Reactivation dialog ──────────────────────────────────── */}
      <Dialog open={showReactivate} onOpenChange={setShowReactivate}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-zinc-200 dark:border-zinc-800">
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mx-auto">
              <PlayCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-center space-y-2">
              <DialogTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Conta pausada
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400">
                Sua conta está pausada. Deseja reativá-la e continuar usando a plataforma?
              </DialogDescription>
            </div>
          </div>
          <div className="flex flex-col gap-2 p-6 pt-0">
            <Button
              onClick={handleReactivate}
              disabled={isReactivating}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl transition-all shadow-sm active:scale-[0.98] text-[15px] flex items-center justify-center gap-2"
            >
              {isReactivating ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Reativando...
                </>
              ) : (
                <>
                  <PlayCircle size={16} /> Reativar conta
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowReactivate(false)}
              disabled={isReactivating}
              className="w-full h-11 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium rounded-xl text-[15px]"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
