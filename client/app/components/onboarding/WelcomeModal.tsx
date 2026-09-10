"use client";

import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, FileOutput } from "lucide-react";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  { icon: FileText, label: "Formulários personalizados" },
  { icon: Sparkles, label: "Análise por IA" },
  { icon: FileOutput, label: "Relatórios em PDF" },
];

export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[440px] w-[92vw] p-0 overflow-hidden border-zinc-200 dark:border-white/[0.08] shadow-2xl bg-white dark:bg-[#0A0A0A] font-sans gap-0"
      >
        {/* Header with subtle primary tint */}
        <div
          className="relative px-7 pt-8 pb-6 overflow-hidden"
          style={{ background: "color-mix(in oklch, var(--primary) 7%, transparent)" }}
        >
          {/* Decorative background circles */}
          <div
            className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-[0.06] blur-2xl pointer-events-none"
            style={{ background: "var(--primary)" }}
          />
          <div
            className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-[0.05] blur-xl pointer-events-none"
            style={{ background: "var(--primary)" }}
          />

          {/* Logo mark */}
          <div className="relative mb-5">
            <div
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl shadow-sm"
              style={{
                background: "color-mix(in oklch, var(--primary) 14%, white)",
                border: "1px solid color-mix(in oklch, var(--primary) 22%, transparent)",
              }}
            >
              <span className="text-[15px] font-black tracking-tight" style={{ color: "var(--primary)" }}>
                onb.
              </span>
            </div>
          </div>

          <h2 className="text-[22px] font-bold text-zinc-900 dark:text-white leading-snug mb-2">
            Bem-vindo ao onb.
          </h2>
          <p className="text-[13.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Sua plataforma para coletar briefings de clientes de forma profissional.
          </p>
        </div>

        {/* Feature pills */}
        <div className="px-7 py-5 border-t border-b border-zinc-100 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02]">
          <div className="flex flex-col gap-2.5">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: "color-mix(in oklch, var(--primary) 10%, transparent)",
                    border: "1px solid color-mix(in oklch, var(--primary) 18%, transparent)",
                  }}
                >
                  <Icon size={12} style={{ color: "var(--primary)" }} strokeWidth={2.2} />
                </div>
                <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-7 py-6 flex flex-col gap-2.5">
          <Button
            onClick={onClose}
            className="w-full h-10 text-[13.5px] font-semibold rounded-lg shadow-sm transition-all"
            style={{ background: "var(--primary)", color: "white" }}
          >
            Começar agora →
          </Button>
          <p className="text-center text-[11.5px] text-zinc-400 dark:text-zinc-600 leading-snug">
            Leva menos de 2 minutos para criar seu primeiro formulário
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
