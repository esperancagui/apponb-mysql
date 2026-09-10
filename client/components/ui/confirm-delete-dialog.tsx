"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  variant?: "danger" | "warning";
}

export default function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Deletar",
  cancelLabel = "Cancelar",
  onConfirm,
  isLoading = false,
  variant = "danger",
}: ConfirmDeleteDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[380px] p-0 overflow-hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border-zinc-200/60 dark:border-white/10 shadow-2xl rounded-2xl font-sans"
      >
        {/* Icon + Text */}
        <div className="flex flex-col items-center text-center px-6 pt-7 pb-2">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
              variant === "danger" ? "bg-red-50 dark:bg-red-950/30" : "bg-amber-50 dark:bg-amber-950/30"
            }`}
          >
            <AlertTriangle
              size={24}
              className={variant === "danger" ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400"}
            />
          </div>
          <DialogTitle className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
            {title}
          </DialogTitle>
          <DialogDescription className="text-[13.5px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[280px]">
            {description}
          </DialogDescription>
        </div>

        {/* Action Buttons — stacked like iOS */}
        <div className="border-t border-zinc-200/60 dark:border-white/10 flex flex-col">
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`w-full py-3 text-[15px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              variant === "danger"
                ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 active:bg-red-100 dark:active:bg-red-950/30"
                : "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 active:bg-amber-100 dark:active:bg-amber-950/30"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Deletando...
              </>
            ) : (
              confirmLabel
            )}
          </button>
          <div className="h-px bg-zinc-200/60 dark:bg-white/10" />
          <button
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full py-3 text-[15px] font-semibold text-blue-500 hover:bg-zinc-50 dark:hover:bg-white/5 active:bg-zinc-100 dark:active:bg-white/10 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
