"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { workspaceService } from "@/app/lib/services";
import { acceptInvite } from "@/app/lib/services/inviteService";
import type { InviteInfo } from "@/app/lib/types";
import { useAuth } from "@/app/contexts";
import { Button } from "@/components/ui/button";
import { Loader2, Users, CheckCircle2, AlertCircle, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, loading: authLoading } = useAuth();
  const code = params.code as string;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!code) return;
    setIsLoading(true);
    workspaceService
      .getInviteInfo(code)
      .then(setInvite)
      .catch((e) => {
        if (e?.message?.includes("Failed to fetch") || e?.message?.includes("NetworkError")) {
          setError("Erro de conexão. Verifique sua internet e tente novamente.");
          setIsNetworkError(true);
        } else {
          setError(e?.message || "Convite não encontrado ou expirado");
          setIsNetworkError(false);
        }
      })
      .finally(() => setIsLoading(false));
  }, [code]);

  async function handleAccept() {
    if (!code) return;
    setIsAccepting(true);
    try {
      const result = await acceptInvite(code);
      setAccepted(true);
      toast.success("Convite aceito! Você foi adicionado ao workspace.");
      // Redirect to dashboard after a brief delay
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao aceitar convite");
    } finally {
      setIsAccepting(false);
    }
  }

  const brandColor = invite?.workspaceBrandColor || "#6366f1";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-[#111] border border-zinc-200/70 dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-lg">
          {/* Header with brand gradient */}
          <div
            className="h-20 relative"
            style={{
              background: `linear-gradient(135deg, ${brandColor}30 0%, ${brandColor}10 100%)`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 80% 20%, ${brandColor}20, transparent 65%)`,
              }}
            />
          </div>

          <div className="px-6 pb-6 -mt-6 relative">
            {/* Workspace logo/icon */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 border-4 border-white dark:border-[#111] overflow-hidden"
              style={{ background: `${brandColor}18`, border: `3px solid white` }}
            >
              {invite?.workspaceLogoUrl ? (
                <img src={invite.workspaceLogoUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <Users size={22} style={{ color: brandColor }} />
              )}
            </div>

            {isLoading || authLoading ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 size={24} className="animate-spin text-zinc-400" />
                <p className="text-[13px] text-zinc-400">Carregando convite...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center py-6 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center">
                  <AlertCircle size={22} className="text-red-500" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-zinc-900 dark:text-white">Convite inválido</p>
                  <p className="text-[12.5px] text-zinc-500 mt-1">{error}</p>
                </div>
                <Button
                  variant="outline"
                  className="mt-2 text-[12px]"
                  onClick={() => (isNetworkError ? window.location.reload() : router.push("/dashboard"))}
                >
                  {isNetworkError ? "Tentar novamente" : "Ir para o Dashboard"}
                </Button>
              </div>
            ) : accepted ? (
              <div className="flex flex-col items-center py-6 gap-3 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: `${brandColor}15` }}
                >
                  <CheckCircle2 size={22} style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-zinc-900 dark:text-white">Bem-vindo!</p>
                  <p className="text-[12.5px] text-zinc-500 mt-1">
                    Você agora faz parte de <strong>{invite?.workspaceName}</strong>.
                  </p>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">Redirecionando...</p>
              </div>
            ) : (
              <>
                <h1 className="text-[17px] font-bold text-zinc-900 dark:text-white leading-snug">
                  Convite para workspace
                </h1>
                <p className="text-[13px] text-zinc-500 mt-1.5 leading-relaxed">
                  Você foi convidado para entrar em{" "}
                  <strong className="text-zinc-900 dark:text-white">{invite?.workspaceName}</strong> como{" "}
                  <span className="font-semibold" style={{ color: brandColor }}>
                    {invite?.role === "admin" ? "Admin" : invite?.role === "viewer" ? "Visualizador" : "Membro"}
                  </span>
                  .
                </p>

                <div className="mt-6">
                  {currentUser ? (
                    <Button
                      onClick={handleAccept}
                      disabled={isAccepting}
                      className="w-full h-10 text-[13px] font-semibold gap-2"
                      style={{ background: brandColor }}
                    >
                      {isAccepting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Aceitando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          Aceitar Convite
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="text-center space-y-3">
                      <p className="text-[12px] text-zinc-500">Faça login para aceitar o convite.</p>
                      <Button
                        onClick={() => router.push(`/login?redirect=/invite/${code}`)}
                        className="w-full h-10 text-[13px] font-semibold gap-2"
                        style={{ background: brandColor }}
                      >
                        <LogIn size={14} />
                        Fazer Login
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Branding footer */}
        <div className="flex justify-center mt-5">
          <a
            href="https://onb.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-500 transition-colors"
          >
            Powered by onb.
          </a>
        </div>
      </div>
    </div>
  );
}
