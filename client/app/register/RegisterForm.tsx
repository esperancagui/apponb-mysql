"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Logo from "@/app/components/Logo";
import { useAuth } from "@/app/contexts";
import { toast } from "sonner";

export default function RegisterForm() {
  const { register, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = nameRef.current?.value.trim() ?? "";
    const email = emailRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";
    const confirm = confirmRef.current?.value ?? "";

    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);
    try {
      await register(name, email, password);
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocorreu um erro.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result === "popup-closed") return;
      if (Array.isArray(result) && result[0] === "account-disabled") {
        toast.error("Esta conta está desativada. Entre em contato com o suporte.");
        return;
      }
      router.push("/dashboard");
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
              Criar conta
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Comece gratuitamente. Sem cartão de crédito.</p>
          </div>

          {/* Terms checkbox — vem antes de qualquer opção de cadastro */}
          <label className="flex items-start gap-3 cursor-pointer group pb-1">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-4 w-4 rounded-[4px] border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 transition-colors peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 group-hover:border-zinc-400 dark:group-hover:border-zinc-600 flex items-center justify-center">
                {termsAccepted && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed select-none">
              Li e concordo com os{" "}
              <Link
                href="/terms"
                target="_blank"
                className="font-medium text-zinc-800 dark:text-zinc-200 hover:underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                Termos e Condições
              </Link>{" "}
              e a{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="font-medium text-zinc-800 dark:text-zinc-200 hover:underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                Política de Privacidade
              </Link>
              .
            </span>
          </label>

          {/* Google */}
          <Button
            variant="outline"
            type="button"
            disabled={isGoogleLoading || isLoading || !termsAccepted}
            onClick={handleGoogle}
            className="w-full h-11 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-medium transition-colors rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continuar com o Google
          </Button>

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
                  ref={nameRef}
                  id="name"
                  type="text"
                  placeholder="Nome completo"
                  required
                  disabled={isLoading}
                  className="h-12 border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 placeholder:text-zinc-400 text-[15px]"
                />
              </div>
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
              <div className="relative border-b border-zinc-200 dark:border-zinc-800">
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
              <div className="relative">
                <Input
                  ref={confirmRef}
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirmar senha"
                  required
                  disabled={isLoading}
                  className="h-12 border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 pr-12 placeholder:text-zinc-400 text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !termsAccepted}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl transition-all mt-2 shadow-sm active:scale-[0.98] text-[15px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Criando conta...
                </>
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500 pt-6">
            Já tem uma conta?{" "}
            <Link
              href="/login"
              className="font-medium text-black dark:text-white hover:underline underline-offset-4"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
