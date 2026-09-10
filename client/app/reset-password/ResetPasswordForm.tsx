"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2 } from "lucide-react";
import Logo from "@/app/components/Logo";
import { authClient } from "@/app/lib/authClient";
import { toast } from "sonner";

/**
 * Confirms a password reset token (sent by POST /api/v1/auth/forgot-password).
 * Firebase used to host this page itself; now it lives in the app since the
 * server issues its own reset tokens.
 */
export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = passwordRef.current?.value ?? "";
    const confirm = confirmRef.current?.value ?? "";
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    setIsLoading(true);
    try {
      await authClient.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocorreu um erro.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-zinc-950 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800">
      <div className="w-full max-w-[380px] px-8 py-10">
        <div className="flex justify-center mb-12">
          <Link href="/" className="inline-block transition-transform hover:scale-105 active:scale-95 duration-200">
            <div className="w-24 h-10 flex items-center justify-center">
              <Logo className="w-full h-full text-primary fill-current drop-shadow-sm" />
            </div>
          </Link>
        </div>

        {!token ? (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Link inválido
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Este link de redefinição de senha está incompleto ou expirou.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors pt-2"
            >
              Solicitar novo link
            </Link>
          </div>
        ) : done ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 size={48} className="text-emerald-500" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Senha redefinida!
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Redirecionando para o login...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Redefinir senha
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Escolha uma nova senha para sua conta.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 shadow-sm focus-within:ring-2 focus-within:ring-zinc-200 dark:focus-within:ring-zinc-800 transition-all">
                <Input
                  ref={passwordRef}
                  id="password"
                  type="password"
                  placeholder="Nova senha"
                  required
                  minLength={8}
                  disabled={isLoading}
                  className="h-12 border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 placeholder:text-zinc-400 text-[15px]"
                />
              </div>
              <div className="flex flex-col rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 shadow-sm focus-within:ring-2 focus-within:ring-zinc-200 dark:focus-within:ring-zinc-800 transition-all">
                <Input
                  ref={confirmRef}
                  id="confirm"
                  type="password"
                  placeholder="Confirmar senha"
                  required
                  minLength={8}
                  disabled={isLoading}
                  className="h-12 border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 placeholder:text-zinc-400 text-[15px]"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl transition-all shadow-sm active:scale-[0.98] text-[15px] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Salvando...
                  </>
                ) : (
                  "Redefinir senha"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-zinc-500 pt-4">
              <Link
                href="/login"
                className="font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Voltar para o login
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
