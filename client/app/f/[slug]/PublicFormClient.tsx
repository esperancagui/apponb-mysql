"use client";

import React, { useEffect, useState } from "react";
import { formService } from "@/app/lib/services";
import { Form } from "@/app/lib/types";
import FormRenderer from "@/app/components/form/FormRenderer";
import { FileX, ArrowLeft } from "lucide-react";
import Link from "next/link";

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-start pt-16 px-4">
      <div className="w-full max-w-lg space-y-8 animate-pulse">
        {/* Logo placeholder */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
        {/* Title placeholder */}
        <div className="space-y-3 text-center">
          <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-2/3 mx-auto" />
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md w-1/2 mx-auto" />
        </div>
        {/* Fields placeholder */}
        <div className="space-y-4 bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
              <div className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
            </div>
          ))}
          <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded-lg mt-2 w-1/3" />
        </div>
      </div>
    </div>
  );
}

export default function PublicFormClient({ slug }: { slug: string }) {
  const [form, setForm] = useState<Form | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    formService.getFormBySlug(slug).then((data) => {
      setForm(data || null);
      setIsLoading(false);
    });
  }, [slug]);

  // Sync html/body background to match form branding so iOS overscroll
  // doesn't reveal the dark-mode body color behind the form's background.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    let bg = "#ffffff";
    if (form?.branding) {
      const b = form.branding;
      if (b.backgroundType === "gradient") {
        const match = b.backgroundValue?.match(/#[0-9a-fA-F]{3,8}/);
        bg = match ? match[0] : "#ffffff";
      } else {
        bg = b.backgroundValue || "#ffffff";
      }
    }

    html.style.backgroundColor = bg;
    body.style.backgroundColor = bg;

    return () => {
      html.style.backgroundColor = "";
      body.style.backgroundColor = "";
    };
  }, [form]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!form || form.status !== "active") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-white dark:bg-zinc-950">
        <div className="w-full max-w-sm space-y-6">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center shadow-sm">
            <FileX size={32} className="text-zinc-300 dark:text-zinc-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-[22px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Formulário não encontrado
            </h1>
            <p className="text-[14px] text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
              Este link pode ter expirado ou o formulário foi removido. Entre em contato com quem te enviou o link.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft size={14} />
              Voltar ao início
            </Link>
          </div>
          <p className="text-[11px] text-zinc-300 dark:text-zinc-700 font-medium tracking-wider uppercase pt-4">
            onb.
          </p>
        </div>
      </div>
    );
  }

  return <FormRenderer form={form} />;
}
