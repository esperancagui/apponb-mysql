"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2 } from "lucide-react";
import Logo from "@/app/components/Logo";
import { useAuth } from "@/app/contexts";
import { toast } from "sonner";

export default function ForgotPasswordForm() {
  const { resetPassword } = useAuth();
  const emailRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = emailRef.current?.value ?? "";
    setIsLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocorreu um erro.");
    } finally {
      setIsLoading(false);
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

        {sent ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 size={48} className="text-emerald-500" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              E-mail enviado!
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Enviamos um e-mail de recuperação para{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{emailRef.current?.value}</span>.
              <br />
              Verifique sua caixa de entrada.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors pt-2"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Recuperar senha
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Informe seu e-mail e enviaremos um link de recuperação.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 shadow-sm focus-within:ring-2 focus-within:ring-zinc-200 dark:focus-within:ring-zinc-800 transition-all">
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

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl transition-all shadow-sm active:scale-[0.98] text-[15px] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
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
