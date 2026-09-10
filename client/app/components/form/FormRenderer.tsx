"use client";

import React, { useState } from "react";
import { Form, FieldType } from "@/app/lib/types";
import { submissionService } from "@/app/lib/services";
import { uploadSubmissionFile, deleteStorageImage } from "@/app/lib/services/storageService";
import {
  Upload,
  ChevronRight,
  CheckCircle2,
  X,
  Sparkles,
  File as FileIcon,
  MessageCircle,
  Instagram,
  Globe,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  generateTokens,
  generateRadii,
  getButtonStyle,
  getInputStyle,
  getShadow,
  getGlassStyle,
  getTypography,
  withAlpha,
} from "@/app/lib/designSystem";

interface FormRendererProps {
  form: Form;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string; // data URL for images
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ─── Formatting Functions ───
const masks = {
  cpf: (v: string) => {
    v = v.replace(/\D/g, "").slice(0, 11);
    return v
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  },
  cnpj: (v: string) => {
    v = v.replace(/\D/g, "").slice(0, 14);
    return v
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  },
  phone: (v: string) => {
    v = v.replace(/\D/g, "").slice(0, 11);
    if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    return v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  },
  cep: (v: string) => {
    v = v.replace(/\D/g, "").slice(0, 8);
    return v.replace(/(\d{5})(\d)/, "$1-$2");
  },
  currency: (v: string) => {
    v = v.replace(/\D/g, "");
    if (!v) return "";
    const num = parseInt(v, 10) / 100;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  },
  date: (v: string) => {
    v = v.replace(/\D/g, "").slice(0, 8);
    return v.replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})(\d)/, "$1/$2");
  },
  none: (v: string) => v,
};

const applyMask = (value: string, maskType?: "cpf" | "cnpj" | "phone" | "cep" | "currency" | "date" | "none") => {
  if (!maskType || maskType === "none" || !value) return value;
  return masks[maskType](value);
};

const renderFormattedText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(_[\s\S]*?_|\*[\s\S]*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("_") && part.endsWith("_")) {
      return (
        <strong key={i} style={{ fontWeight: 800 }}>
          {part.slice(1, -1)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} style={{ fontStyle: "italic" }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

export default function FormRenderer({ form }: FormRendererProps) {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFile[]>>({});
  const [rawFiles, setRawFiles] = useState<Record<string, File[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingLabel, setSubmittingLabel] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { branding: b, groups } = form;
  const t = generateTokens(b);
  const rad = generateRadii(b);
  const dark = t.isDark;
  const typo = getTypography(b);
  const shadow = getShadow(b);
  const glass = getGlassStyle(b, t);

  // Input style from design system
  const inputTokenStyle = getInputStyle(b, t);
  const inputInlineStyle: React.CSSProperties = {
    ...inputTokenStyle,
    borderRadius: rad.input,
    height: 56,
    fontSize: 16,
    padding: "0 16px",
    outline: "none",
    width: "100%",
    transition: "all 0.2s",
  };

  // Button style from design system
  const btnTokens = getButtonStyle(b, t);
  const btnInlineStyle: React.CSSProperties = {
    ...btnTokens,
    borderRadius: rad.button,
    height: 64,
    width: "100%",
    fontSize: 18,
    fontWeight: typo.titleWeight,
    letterSpacing: typo.letterSpacing,
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: shadow !== "none" ? shadow : undefined,
  };

  // Video embed helper
  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
    // Vimeo
    const vmMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
    // Loom
    const lmMatch = url.match(/loom\.com\/share\/([\w-]+)/);
    if (lmMatch) return `https://www.loom.com/embed/${lmMatch[1]}`;
    return null;
  };

  // Progress calculation based on all visible fields
  const allVisibleFields = groups
    .flatMap((g) => g.fields)
    .filter((field) => {
      if (field.dependsOn && answers[field.dependsOn] !== field.dependsOnValue) return false;
      return true;
    });

  const totalFields = allVisibleFields.length;

  const answeredFields = allVisibleFields.filter((field) => {
    if (field.type === "file") {
      return (uploadedFiles[field.id]?.length || 0) > 0;
    }
    const v = answers[field.id];
    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }).length;

  const progressPct = totalFields > 0 ? Math.round((answeredFields / totalFields) * 100) : 0;

  const bgStyle = b.backgroundType === "gradient" ? { background: b.backgroundValue } : { backgroundColor: t.bg };

  // ─── File Handlers ──
  const handleFiles = (fieldId: string, fileList: FileList) => {
    const newFiles: UploadedFile[] = [];
    const newRawFiles: File[] = [];
    Array.from(fileList).forEach((file) => {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`"${file.name}" é muito grande (máx 25MB)`);
        return;
      }

      const uploaded: UploadedFile = {
        id: Math.random().toString(36).slice(2),
        name: file.name,
        size: file.size,
        type: file.type,
      };

      // Generate preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setUploadedFiles((prev) => ({
            ...prev,
            [fieldId]: (prev[fieldId] || []).map((f) =>
              f.id === uploaded.id ? { ...f, preview: reader.result as string } : f,
            ),
          }));
        };
        reader.readAsDataURL(file);
      }

      newFiles.push(uploaded);
      newRawFiles.push(file);
    });

    setUploadedFiles((prev) => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] || []), ...newFiles],
    }));

    // Retain raw File blobs for upload on submit
    setRawFiles((prev) => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] || []), ...newRawFiles],
    }));

    // Also update answers for form submission
    setAnswers((prev) => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] || []), ...newFiles.map((f) => f.name)],
    }));

    if (newFiles.length > 0) toast.success(`${newFiles.length} arquivo(s) adicionado(s)`);
  };

  const removeFile = (fieldId: string, fileId: string) => {
    const fileIndex = (uploadedFiles[fieldId] || []).findIndex((f) => f.id === fileId);
    setUploadedFiles((prev) => ({
      ...prev,
      [fieldId]: (prev[fieldId] || []).filter((f) => f.id !== fileId),
    }));
    // Also remove from raw files (by matching index)
    if (fileIndex >= 0) {
      setRawFiles((prev) => ({
        ...prev,
        [fieldId]: (prev[fieldId] || []).filter((_, i) => i !== fileIndex),
      }));
    }
    setAnswers((prev) => {
      const files = uploadedFiles[fieldId]?.filter((f) => f.id !== fileId) || [];
      return { ...prev, [fieldId]: files.map((f) => f.name) };
    });
  };

  const handleNext = () => {
    const currentGroup = groups[currentGroupIndex];
    if (currentGroup) {
      const requiredFieldsMissing = currentGroup.fields.filter((f) => {
        if (!f.required) return false;
        if (f.dependsOn && answers[f.dependsOn] !== f.dependsOnValue) return false;

        if (f.type === "file") {
          return (uploadedFiles[f.id]?.length || 0) === 0;
        }
        const v = answers[f.id];
        return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
      });

      if (requiredFieldsMissing.length > 0) {
        toast.error("Por favor, preencha todos os campos obrigatórios (*).");
        return;
      }
    }
    setCurrentGroupIndex((i) => Math.min(groups.length - 1, i + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDrop = (e: React.DragEvent, fieldId: string) => {
    e.preventDefault();
    setDragOver(null);
    if (e.dataTransfer.files.length) handleFiles(fieldId, e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const group of groups) {
      for (const field of group.fields) {
        // Skip validation for hidden conditional fields
        if (field.dependsOn && answers[field.dependsOn] !== field.dependsOnValue) {
          continue;
        }

        const val = answers[field.id];
        if (field.required) {
          if (field.type === FieldType.FILE) {
            if (!uploadedFiles[field.id]?.length) {
              toast.error(`Obrigatório: ${field.label}`);
              return;
            }
          } else if (!val) {
            toast.error(`Obrigatório: ${field.label}`);
            return;
          }
        }

        // Validation patterns if field has value
        if (val) {
          if (field.type === FieldType.EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            toast.error(`E-mail inválido em: ${field.label}`);
            return;
          }
          if (field.mask === "cpf" && val.replace(/\D/g, "").length < 11) {
            toast.error(`CPF incompleto em: ${field.label}`);
            return;
          }
          if (field.mask === "cnpj" && val.replace(/\D/g, "").length < 14) {
            toast.error(`CNPJ incompleto em: ${field.label}`);
            return;
          }
          if (field.mask === "cep" && val.replace(/\D/g, "").length < 8) {
            toast.error(`CEP incompleto em: ${field.label}`);
            return;
          }
          if (field.mask === "phone" && val.replace(/\D/g, "").length < 10) {
            toast.error(`Telefone inválido em: ${field.label}`);
            return;
          }
          if (field.mask === "date" && val.replace(/\D/g, "").length < 8) {
            toast.error(`Data incompleta em: ${field.label}`);
            return;
          }
        }
      }
    }

    setIsSubmitting(true);
    // Declared outside try so catch can delete already-uploaded files on failure
    const filesMap: Record<string, string[]> = {};
    try {
      // Build final answers payload (excluding hidden fields)
      const finalAnswers: Record<string, any> = {};
      for (const group of groups) {
        for (const field of group.fields) {
          if (field.dependsOn && answers[field.dependsOn] !== field.dependsOnValue) {
            continue;
          }
          if (answers[field.id] !== undefined) {
            finalAnswers[field.id] = answers[field.id];
          }
        }
      }

      // Upload all files to Firebase Storage and replace filenames with URLs
      const fileFieldIds = Object.keys(rawFiles).filter((fid) => (rawFiles[fid]?.length || 0) > 0);

      if (fileFieldIds.length > 0) {
        setSubmittingLabel("Enviando arquivos...");
        for (const fieldId of fileFieldIds) {
          const fieldFiles = rawFiles[fieldId] || [];
          const urls: string[] = [];
          for (const file of fieldFiles) {
            const url = await uploadSubmissionFile(file, form.id, fieldId);
            urls.push(url);
          }
          // Replace filenames with URLs in answers
          finalAnswers[fieldId] = urls;
          filesMap[fieldId] = urls;
        }
      }

      setSubmittingLabel("Enviando resposta...");
      await submissionService.createSubmission({
        formId: form.id,
        data: finalAnswers,
        files: Object.keys(filesMap).length > 0 ? filesMap : undefined,
        workspaceId: form.workspaceId,
      });
      setIsSubmitted(true);
    } catch (err) {
      // Roll back any files already uploaded to avoid orphans in Storage
      const uploadedUrls = Object.values(filesMap).flat();
      await Promise.allSettled(uploadedUrls.map(deleteStorageImage));

      console.error("Erro ao enviar formulário:", err);
      toast.error("Falha ao enviar o formulário. Tente novamente.");
    } finally {
      setIsSubmitting(false);
      setSubmittingLabel("");
    }
  };

  if (isSubmitted) {
    return (
      <div
        style={{
          ...bgStyle,
          fontFamily: b.fontFamily,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              alignItems: "center",
              width: "100%",
              maxWidth: 320,
            }}
          >
            <CheckCircle2 style={{ width: 80, height: 80, color: t.primary }} />
            <div>
              <h1
                style={{ fontSize: 30, fontWeight: typo.titleWeight, letterSpacing: typo.letterSpacing, color: t.text }}
              >
                Obrigado!
              </h1>
              <p style={{ color: t.textSecondary, marginTop: 8 }}>{b.thankYouMessage}</p>
            </div>

            {b.showSocialOnSuccess !== false && typeof window !== "undefined" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  alignItems: "center",
                  width: "100%",
                  marginTop: 16,
                }}
              >
                {/* Enfatizar WhatsApp Redirecionamento */}
                {b.whatsappNumber && (
                  <a
                    href={`https://wa.me/${b.whatsappNumber.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      borderRadius: rad.button,
                      backgroundColor: t.primary,
                      color: t.textInverse,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "14px 24px",
                      width: "100%",
                      textDecoration: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  >
                    <MessageCircle size={18} color="currentColor" />{" "}
                    <span style={{ fontSize: 14, fontWeight: 700, color: "currentColor" }}>Falar no WhatsApp</span>
                  </a>
                )}

                {/* Outros Sociais Menos Evidentes */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
                  {b.instagramHandle && (
                    <a
                      href={`https://instagram.com/${b.instagramHandle.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        borderRadius: rad.button,
                        backgroundColor: t.bgElevated,
                        border: `1px solid ${t.borderSubtle}`,
                        boxShadow: `0 2px 10px ${t.isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)"}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 16px 8px 8px",
                        textDecoration: "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          backgroundColor: t.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        }}
                      >
                        <Instagram size={14} color={t.text} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Instagram</span>
                    </a>
                  )}
                  {b.websiteUrl && (
                    <a
                      href={b.websiteUrl.startsWith("http") ? b.websiteUrl : `https://${b.websiteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        borderRadius: rad.button,
                        backgroundColor: t.bgElevated,
                        border: `1px solid ${t.borderSubtle}`,
                        boxShadow: `0 2px 10px ${t.isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)"}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 16px 8px 8px",
                        textDecoration: "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          backgroundColor: t.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        }}
                      >
                        <Globe size={14} color={t.text} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Site</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {b.showOnbBadge && (
          <div
            style={{
              padding: "32px 0",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <a
              href="https://onb.app"
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center gap-2.5 px-3.5 py-1.5 rounded-full backdrop-blur-md border hover:-translate-y-0.5 transition-all duration-300 ${dark ? "bg-white/10 border-white/15 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4)]" : "bg-black/[0.05] border-black/[0.08] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.1)]"}`}
              style={{ textDecoration: "none" }}
            >
              <span className={`text-[10px] font-semibold uppercase tracking-[0.25em] transition-colors ${dark ? "text-white/40 group-hover:text-white/60" : "text-zinc-400 group-hover:text-zinc-500"}`}>
                Powered by
              </span>
              <div className={`w-8 h-3.5 flex items-center justify-center group-hover:text-primary transition-colors duration-300 ${dark ? "text-white/80" : "text-zinc-900"}`}>
                <svg viewBox="0 0 384 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <path
                    d="M55.2 157C44.4 157 34.8666 154.667 26.6 150C18.3333 145.2 11.8 138.667 6.99998 130.4C2.33331 122 -2.38717e-05 112.4 -2.38717e-05 101.6C-2.38717e-05 90.6667 2.33331 81.0667 6.99998 72.8C11.8 64.4 18.3333 57.8667 26.6 53.2C34.8666 48.4 44.4 46 55.2 46C65.8666 46 75.3333 48.4 83.6 53.2C91.8667 57.8667 98.3333 64.4 103 72.8C107.8 81.0667 110.2 90.6667 110.2 101.6C110.2 112.4 107.867 122 103.2 130.4C98.5333 138.667 92.0667 145.2 83.8 150C75.5333 154.667 66 157 55.2 157ZM55.2 139C62.1333 139 68.2666 137.4 73.6 134.2C78.9333 131 83.0666 126.6 86 121C89.0666 115.4 90.6 108.933 90.6 101.6C90.6 94.2667 89.0666 87.8 86 82.2C83.0666 76.4667 78.9333 72 73.6 68.8C68.2666 65.6 62.1333 64 55.2 64C48.2666 64 42.1333 65.6 36.8 68.8C31.4666 72 27.2666 76.4667 24.2 82.2C21.1333 87.8 19.6 94.2667 19.6 101.6C19.6 108.933 21.1333 115.4 24.2 121C27.2666 126.6 31.4666 131 36.8 134.2C42.1333 137.4 48.2666 139 55.2 139ZM214.961 156.4C212.028 156.4 209.561 155.467 207.561 153.6C205.694 151.6 204.761 149.133 204.761 146.2V97C204.761 89.4 203.361 83.2 200.561 78.4C197.761 73.6 193.961 70.0667 189.161 67.8C184.494 65.4 179.094 64.2 172.961 64.2C167.361 64.2 162.294 65.3333 157.761 67.6C153.228 69.8667 149.628 72.9333 146.961 76.8C144.294 80.5333 142.961 84.8667 142.961 89.8H130.361C130.361 81.4 132.361 73.9333 136.361 67.4C140.494 60.7333 146.094 55.4667 153.161 51.6C160.228 47.7333 168.161 45.8 176.961 45.8C186.161 45.8 194.361 47.8 201.561 51.8C208.894 55.6667 214.628 61.4 218.761 69C223.028 76.6 225.161 85.9333 225.161 97V146.2C225.161 149.133 224.161 151.6 222.161 153.6C220.294 155.467 217.894 156.4 214.961 156.4ZM132.761 156.4C129.828 156.4 127.361 155.467 125.361 153.6C123.494 151.6 122.561 149.133 122.561 146.2V57C122.561 53.9333 123.494 51.4667 125.361 49.6C127.361 47.7333 129.828 46.8 132.761 46.8C135.828 46.8 138.294 47.7333 140.161 49.6C142.028 51.4667 142.961 53.9333 142.961 57V146.2C142.961 149.133 142.028 151.6 140.161 153.6C138.294 155.467 135.828 156.4 132.761 156.4ZM295.889 157C285.489 157 276.156 154.6 267.889 149.8C259.622 144.867 253.089 138.2 248.289 129.8C243.489 121.4 241.022 111.933 240.889 101.4V10.2C240.889 7.13334 241.822 4.66667 243.689 2.80001C245.689 0.933342 248.156 8.58307e-06 251.089 8.58307e-06C254.156 8.58307e-06 256.622 0.933342 258.489 2.80001C260.356 4.66667 261.289 7.13334 261.289 10.2V64.2C265.956 58.6 271.556 54.2 278.089 51C284.756 47.6667 292.022 46 299.889 46C309.622 46 318.356 48.4667 326.089 53.4C333.822 58.2 339.889 64.8 344.289 73.2C348.822 81.4667 351.089 90.8667 351.089 101.4C351.089 111.933 348.622 121.4 343.689 129.8C338.889 138.2 332.356 144.867 324.089 149.8C315.822 154.6 306.422 157 295.889 157ZM295.889 139C302.689 139 308.756 137.4 314.089 134.2C319.422 130.867 323.622 126.333 326.689 120.6C329.889 114.867 331.489 108.467 331.489 101.4C331.489 94.2 329.889 87.8 326.689 82.2C323.622 76.6 319.422 72.2 314.089 69C308.756 65.6667 302.689 64 295.889 64C289.222 64 283.156 65.6667 277.689 69C272.356 72.2 268.156 76.6 265.089 82.2C262.022 87.8 260.489 94.2 260.489 101.4C260.489 108.467 262.022 114.867 265.089 120.6C268.156 126.333 272.356 130.867 277.689 134.2C283.156 137.4 289.222 139 295.889 139ZM369.314 159.4C365.581 159.4 362.314 158.067 359.514 155.4C356.847 152.6 355.514 149.333 355.514 145.6C355.514 141.733 356.847 138.467 359.514 135.8C362.314 133 365.581 131.6 369.314 131.6C373.181 131.6 376.447 133 379.114 135.8C381.781 138.467 383.114 141.733 383.114 145.6C383.114 149.333 381.781 152.6 379.114 155.4C376.447 158.067 373.181 159.4 369.314 159.4Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </a>
          </div>
        )}
      </div>
    );
  }

  // Hero background
  const heroType = b.heroBackgroundType || "none";
  const heroStyle: React.CSSProperties =
    heroType === "solid"
      ? { backgroundColor: b.heroBackgroundValue || t.bgSecondary }
      : heroType === "gradient"
        ? { background: b.heroBackgroundValue }
        : heroType === "image"
          ? {
              backgroundImage: `url(${b.heroBackgroundValue})`,
              backgroundSize: b.heroBackgroundSize || "cover",
              backgroundPosition: b.heroBackgroundPosition || "center",
            }
          : {};
  const hasHero = heroType !== "none" && b.heroBackgroundValue;

  // Logo
  const logoShape = b.logoShape || "natural";
  const logoBorder = b.logoBorder ?? false;
  const logoW = { small: 48, medium: 80, large: 120, xlarge: 160, xxlarge: 200 }[b.logoSize] || 80;
  const logoSt: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...(logoShape === "circle" ? { borderRadius: "50%" } : logoShape === "square" ? { borderRadius: rad.card } : {}),
    ...(logoShape === "natural"
      ? {}
      : { width: logoW, height: logoW, backgroundColor: b.logoBgColor || "transparent" }),
    ...(logoBorder ? { border: `2px solid ${b.logoBorderColor || t.border}` } : {}),
  };

  const heroTextColor = b.heroTextColor || (heroType === "image" || heroType === "gradient" ? "#ffffff" : t.text);
  const heroSubColor =
    b.heroSubColor || (heroType === "image" || heroType === "gradient" ? "rgba(255,255,255,0.9)" : t.textSecondary);

  // ─── Main Form ──
  return (
    <div style={{ ...bgStyle, fontFamily: b.fontFamily, minHeight: "100vh" }}>
      {/* Hero / Header */}
      {b.headerStyle === "cover" ? (
        <div style={{ position: "relative" }}>
          {/* Cover Banner */}
          <div
            style={{
              height: 180,
              width: "100%",
              position: "relative",
              overflow: "hidden",
              ...(heroType === "solid"
                ? { backgroundColor: b.heroBackgroundValue || t.bgSecondary }
                : heroType === "gradient"
                  ? { backgroundImage: b.heroBackgroundValue }
                  : heroType === "image"
                    ? {
                        backgroundImage: `url(${b.heroBackgroundValue})`,
                        backgroundSize: b.heroBackgroundSize || "cover",
                        backgroundPosition: b.heroBackgroundPosition || "center",
                      }
                    : {}),
            }}
          >
            {/* Overlay to improve readability on images/gradients */}
            {heroType !== "solid" && (heroType === "image" || heroType === "gradient") && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 100%)",
                }}
              />
            )}
          </div>
          {/* Content Area overlapping banner */}
          <div
            style={{
              paddingLeft: 24,
              paddingRight: 24,
              paddingBottom: 24,
              maxWidth: 672,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: b.logoPosition === "center" ? "center" : "flex-start",
              textAlign: b.logoPosition === "center" ? "center" : "left",
              position: "relative",
            }}
          >
            {/* Overlapping Logo */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              style={{
                ...logoSt,
                marginTop: -(logoW / 2 + 10), // Vaza metade pra fora do banner
                minHeight: logoW / 2 + 10,
                ...(logoShape !== "natural" ? { border: `4px solid ${b.logoBorderColor || t.bg}` } : {}), // Só bota borda grossa se não for 'livre'
                zIndex: 10,
              }}
            >
              {b.logoUrl ? (
                <img
                  src={b.logoUrl}
                  alt="Logo"
                  style={
                    logoShape === "natural"
                      ? { maxWidth: logoW, maxHeight: logoW }
                      : { width: "100%", height: "100%", objectFit: "contain" }
                  }
                />
              ) : (
                <span style={{ fontWeight: 700, color: t.primary, fontSize: logoW * 0.4 }}>
                  {b.businessName.charAt(0)}
                </span>
              )}
            </motion.div>

            {/* Texts */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              style={{ marginTop: 16 }}
            >
              <h1
                style={{
                  fontSize: 30,
                  fontWeight: typo.titleWeight,
                  letterSpacing: typo.letterSpacing,
                  color: b.heroTextColor || t.text,
                }}
              >
                {b.businessName}
              </h1>
              <p
                style={{
                  color: b.heroSubColor || t.textSecondary,
                  maxWidth: 500,
                  fontWeight: 500,
                  marginTop: 8,
                }}
              >
                {b.welcomeMessage}
              </p>
            </motion.div>
          </div>
        </div>
      ) : hasHero ? (
        <div style={{ position: "relative" }}>
          <div
            style={{
              ...heroStyle,
              padding: "64px 24px 80px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {b.headerStyle !== "minimal" && (
              <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={logoSt}>
                {b.logoUrl ? (
                  <img
                    src={b.logoUrl}
                    alt="Logo"
                    style={
                      logoShape === "natural"
                        ? { maxWidth: logoW, maxHeight: logoW }
                        : { width: "100%", height: "100%", objectFit: "contain" }
                    }
                  />
                ) : (
                  <span style={{ fontWeight: 700, color: t.primary, fontSize: logoW * 0.4 }}>
                    {b.businessName.charAt(0)}
                  </span>
                )}
              </motion.div>
            )}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              style={{ marginTop: 20 }}
            >
              <h1
                style={{
                  fontSize: 30,
                  fontWeight: typo.titleWeight,
                  letterSpacing: typo.letterSpacing,
                  color: heroTextColor,
                }}
              >
                {b.businessName}
              </h1>
              <p style={{ color: heroSubColor, maxWidth: 500, fontWeight: 500, marginTop: 8 }}>{b.welcomeMessage}</p>
            </motion.div>
          </div>
          {/* Gradient fade from hero to form background */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
              background: `linear-gradient(to bottom, transparent, ${t.bg})`,
              pointerEvents: "none",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            paddingTop: 40,
            paddingBottom: 16,
            paddingLeft: 24,
            paddingRight: 24,
            maxWidth: 672,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            alignItems: b.logoPosition === "center" ? "center" : "flex-start",
            textAlign: b.logoPosition === "center" ? "center" : "left",
          }}
        >
          {b.headerStyle !== "minimal" && (
            <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={logoSt}>
              {b.logoUrl ? (
                <img
                  src={b.logoUrl}
                  alt="Logo"
                  style={
                    logoShape === "natural"
                      ? { maxWidth: logoW, maxHeight: logoW }
                      : { width: "100%", height: "100%", objectFit: "contain" }
                  }
                />
              ) : (
                <span style={{ fontWeight: 700, color: t.primary, fontSize: logoW * 0.4 }}>
                  {b.businessName.charAt(0)}
                </span>
              )}
            </motion.div>
          )}
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <h1
              style={{ fontSize: 30, fontWeight: typo.titleWeight, letterSpacing: typo.letterSpacing, color: t.text }}
            >
              {b.businessName}
            </h1>
            <p style={{ color: t.textSecondary, maxWidth: 500, fontWeight: 500, marginTop: 8 }}>{b.welcomeMessage}</p>
          </motion.div>
        </div>
      )}

      {/* ─── Sticky Progress Bar ─── */}
      {b.progressBarStyle && b.progressBarStyle !== "none" && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            width: "100%",
            padding: "16px 24px",
            backgroundColor: withAlpha(t.bg, 0.8),
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${t.borderSubtle}`,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: 672 }}>
            {b.progressBarStyle === "line" && (
              <div style={{ height: 6, borderRadius: 4, backgroundColor: t.bgTertiary, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    backgroundColor: t.primary,
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            )}
            {b.progressBarStyle === "steps" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                {groups.map((g, i) => {
                  const allGroupFields = g.fields.filter((f) => {
                    if (f.dependsOn && answers[f.dependsOn] !== f.dependsOnValue) return false;
                    return true;
                  });

                  const sectionResponded = allGroupFields.length > 0 && allGroupFields.every((f) => {
                    if (f.type === "file") return (uploadedFiles[f.id]?.length || 0) > 0;
                    const v = answers[f.id];
                    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
                  });

                  const sectionAnswered = allGroupFields.length === 0 ? currentGroupIndex > i : sectionResponded;
                  return (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          backgroundColor: sectionAnswered ? t.primary : t.bgTertiary,
                          color: sectionAnswered ? t.textInverse : t.textMuted,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          transition: "all 0.3s",
                          boxShadow: sectionAnswered ? `0 0 10px ${withAlpha(t.primary, 0.3)}` : "none",
                        }}
                      >
                        {i + 1}
                      </div>
                      {i < groups.length - 1 && (
                        <div
                          style={{
                            width: 32,
                            height: 2,
                            backgroundColor: sectionAnswered ? t.primary : t.borderSubtle,
                            borderRadius: 2,
                            transition: "all 0.3s",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {b.progressBarStyle === "percentage" && (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 4, backgroundColor: t.bgTertiary, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${progressPct}%`,
                      backgroundColor: t.primary,
                      borderRadius: 4,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text, minWidth: 40, textAlign: "right" }}>
                  {progressPct}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Welcome Video ─── */}
      {b.welcomeVideoUrl && getEmbedUrl(b.welcomeVideoUrl) && (
        <div style={{ maxWidth: 672, margin: "0 auto", padding: "0 24px", paddingTop: 16 }}>
          <div
            style={{
              position: "relative",
              paddingBottom: "56.25%",
              height: 0,
              overflow: "hidden",
              borderRadius: rad.card,
              boxShadow: shadow !== "none" ? shadow : undefined,
              ...glass,
            }}
          >
            <iframe
              src={getEmbedUrl(b.welcomeVideoUrl)!}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      <div style={{ maxWidth: 672, margin: "0 auto", padding: "40px 24px" }}>
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
              e.preventDefault();
            }
          }}
          style={{ display: "flex", flexDirection: "column", gap: 64 }}
        >
          {groups[currentGroupIndex] &&
            (() => {
              const group = groups[currentGroupIndex];
              const gi = currentGroupIndex;
              return (
                <motion.section
                  key={group.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: "flex", flexDirection: "column", gap: 24 }}
                >
                  {/* Section header */}
                  <div>
                    {b.sectionDivider === "number" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            backgroundColor: t.primary,
                            color: t.textInverse,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {gi + 1}
                        </div>
                        <h2
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.15em",
                            color: t.textSecondary,
                          }}
                        >
                          {group.name}
                        </h2>
                      </div>
                    ) : (
                      <>
                        {b.sectionDivider === "line" && (
                          <div style={{ height: 1, backgroundColor: t.borderSubtle, marginBottom: 16 }} />
                        )}
                        <h2
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.2em",
                            color: t.textSecondary,
                          }}
                        >
                          {group.name}
                        </h2>
                      </>
                    )}
                    {group.description && (
                      <p style={{ fontSize: 14, fontStyle: "italic", color: t.textSecondary, marginTop: 4 }}>
                        {group.description}
                      </p>
                    )}
                  </div>

                  {/* Fields */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {group.fields.map((field) => {
                      // Check conditional logic visibility
                      if (field.dependsOn && answers[field.dependsOn] !== field.dependsOnValue) {
                        return null;
                      }

                      return (
                        <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <label
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: t.text,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              paddingLeft: 2,
                            }}
                          >
                            {field.label ? renderFormattedText(field.label) : null}
                            {field.required && <span style={{ color: t.error }}>*</span>}
                          </label>

                          {field.type === FieldType.TEXT && (
                            <input
                              style={inputInlineStyle}
                              placeholder={field.placeholder}
                              value={answers[field.id] || ""}
                              onChange={(e) => {
                                const val = applyMask(e.target.value, field.mask);
                                setAnswers((p) => ({ ...p, [field.id]: val }));
                              }}
                            />
                          )}

                          {/* EMAIL */}
                          {field.type === FieldType.EMAIL && (
                            <input
                              type="email"
                              style={inputInlineStyle}
                              placeholder={field.placeholder || "seu@email.com"}
                              value={answers[field.id] || ""}
                              onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                            />
                          )}

                          {field.type === FieldType.PHONE && (
                            <input
                              type="tel"
                              style={inputInlineStyle}
                              placeholder={field.placeholder || "(00) 00000-0000"}
                              value={answers[field.id] || ""}
                              onChange={(e) => {
                                const val = applyMask(e.target.value, field.mask || "phone");
                                setAnswers((p) => ({ ...p, [field.id]: val }));
                              }}
                            />
                          )}

                          {/* TEXTAREA */}
                          {field.type === FieldType.TEXTAREA && (
                            <textarea
                              style={{
                                ...inputInlineStyle,
                                height: 120,
                                paddingTop: 12,
                                paddingBottom: 12,
                                resize: "vertical",
                              }}
                              placeholder={field.placeholder}
                              onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                            />
                          )}

                          {/* SELECT */}
                          {field.type === FieldType.SELECT && field.options && (
                            <select
                              style={{ ...inputInlineStyle, appearance: "none" as const, cursor: "pointer" }}
                              value={answers[field.id] || ""}
                              onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                            >
                              <option value="" disabled>
                                Selecione...
                              </option>
                              {field.options.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          )}

                          {/* SCALE (Escala de Satisfação) */}
                          {field.type === FieldType.SCALE && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%" }}>
                                {Array.from(
                                  { length: (field.scaleMax ?? 10) - (field.scaleMin ?? 0) + 1 },
                                  (_, i) => i + (field.scaleMin ?? 0),
                                ).map((num) => {
                                  const isSelected = answers[field.id] === num.toString();
                                  return (
                                    <button
                                      key={num}
                                      type="button"
                                      onClick={() => setAnswers((p) => ({ ...p, [field.id]: num.toString() }))}
                                      style={{
                                        flex: 1,
                                        minWidth: 40,
                                        height: 48,
                                        borderRadius: 8,
                                        border: `1px solid ${isSelected ? t.primary : t.borderSubtle}`,
                                        backgroundColor: isSelected ? t.primary : "transparent",
                                        color: isSelected ? t.textInverse : t.text,
                                        fontSize: 16,
                                        fontWeight: isSelected ? 700 : 500,
                                        cursor: "pointer",
                                        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                                      }}
                                    >
                                      {num}
                                    </button>
                                  );
                                })}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: 13,
                                  color: t.textSecondary,
                                  fontWeight: 500,
                                }}
                              >
                                <span>{field.scaleMinLabel}</span>
                                <span>{field.scaleMaxLabel}</span>
                              </div>
                            </div>
                          )}

                          {/* FILE — Multi-upload with previews */}
                          {field.type === FieldType.FILE && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              {/* Drop zone */}
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setDragOver(field.id);
                                }}
                                onDragLeave={() => setDragOver(null)}
                                onDrop={(e) => handleDrop(e, field.id)}
                                onClick={() => {
                                  const i = document.createElement("input");
                                  i.type = "file";
                                  i.multiple = true;
                                  i.accept = "image/*,.pdf,.svg,.ai,.psd,.sketch,.fig,.zip";
                                  i.onchange = (e) => {
                                    const files = (e.target as HTMLInputElement).files;
                                    if (files) handleFiles(field.id, files);
                                  };
                                  i.click();
                                }}
                                style={{
                                  border: `2px dashed ${dragOver === field.id ? t.primary : t.border}`,
                                  backgroundColor: dragOver === field.id ? t.primaryMuted : t.bgTertiary,
                                  borderRadius: rad.card,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 12,
                                  padding: "32px 16px",
                                  cursor: "pointer",
                                  transition: "all 0.2s",
                                }}
                              >
                                <div
                                  style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: "50%",
                                    backgroundColor: dragOver === field.id ? t.primarySoft : t.bgSecondary,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Upload
                                    size={22}
                                    style={{ color: dragOver === field.id ? t.primary : t.textMuted }}
                                  />
                                </div>
                                <div style={{ textAlign: "center" }}>
                                  <p style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                                    {dragOver === field.id ? "Solte aqui" : "Arraste ou clique para enviar"}
                                  </p>
                                  <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                                    PNG, JPG, PDF, SVG, AI, PSD • Até 25MB cada
                                  </p>
                                </div>
                              </div>

                              {/* Uploaded files grid */}
                              {(uploadedFiles[field.id] || []).length > 0 && (
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                                    gap: 8,
                                  }}
                                >
                                  {(uploadedFiles[field.id] || []).map((file) => (
                                    <div
                                      key={file.id}
                                      style={{
                                        border: `1px solid ${t.border}`,
                                        borderRadius: rad.card,
                                        overflow: "hidden",
                                        backgroundColor: t.bgSecondary,
                                        position: "relative",
                                      }}
                                    >
                                      {file.preview ? (
                                        <div style={{ aspectRatio: "1", overflow: "hidden" }}>
                                          <img
                                            src={file.preview}
                                            alt={file.name}
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                          />
                                        </div>
                                      ) : (
                                        <div
                                          style={{
                                            aspectRatio: "1",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 4,
                                            backgroundColor: t.bgTertiary,
                                          }}
                                        >
                                          <FileIcon size={24} style={{ color: t.textMuted }} />
                                          <span
                                            style={{
                                              fontSize: 10,
                                              fontWeight: 700,
                                              textTransform: "uppercase",
                                              color: t.textMuted,
                                            }}
                                          >
                                            {file.name.split(".").pop()}
                                          </span>
                                        </div>
                                      )}
                                      <div style={{ padding: "6px 8px" }}>
                                        <p
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 500,
                                            color: t.text,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {file.name}
                                        </p>
                                        <p style={{ fontSize: 10, color: t.textMuted }}>{formatFileSize(file.size)}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeFile(field.id, file.id);
                                        }}
                                        style={{
                                          position: "absolute",
                                          top: 6,
                                          right: 6,
                                          width: 24,
                                          height: 24,
                                          backgroundColor: t.error,
                                          color: "#fff",
                                          borderRadius: "50%",
                                          border: "none",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          cursor: "pointer",
                                          opacity: 0.9,
                                        }}
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* AI Tip */}
                          {field.description && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 8,
                                padding: 12,
                                border: `1px solid ${t.borderSubtle}`,
                                borderRadius: rad.card,
                                backgroundColor: b.tipColor || t.primaryMuted,
                              }}
                            >
                              <Sparkles
                                size={14}
                                style={{ color: b.tipTextColor || t.primary, flexShrink: 0, marginTop: 2 }}
                              />
                              <p
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  lineHeight: 1.6,
                                  color: b.tipTextColor || t.textSecondary,
                                }}
                              >
                                {field.description}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.section>
              );
            })()}

          {/* Submit / Pagination */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            {currentGroupIndex > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCurrentGroupIndex((i) => Math.max(0, i - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                style={{
                  ...btnInlineStyle,
                  width: "auto",
                  height: 48,
                  padding: "0 24px",
                  backgroundColor: t.bgTertiary,
                  color: t.textSecondary,
                  border: "none",
                  boxShadow: "none",
                  fontSize: 14,
                }}
              >
                Anterior
              </button>
            )}

            {currentGroupIndex < groups.length - 1 ? (
              <button
                key="next-btn"
                type="button"
                onClick={handleNext}
                style={{ ...btnInlineStyle, width: "auto", height: 48, padding: "0 32px", fontSize: 14 }}
              >
                Próxima
                <ChevronRight
                  style={{ display: "inline", width: 16, height: 16, marginLeft: 6, verticalAlign: "middle" }}
                />
              </button>
            ) : (
              <button
                key="submit-btn"
                type="submit"
                disabled={isSubmitting}
                style={{
                  ...btnInlineStyle,
                  width: "auto",
                  height: 48,
                  padding: "0 32px",
                  fontSize: 14,
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Enviando..." : b.submitButtonText || "Enviar"}
                {!isSubmitting && (
                  <ChevronRight
                    style={{ display: "inline", width: 16, height: 16, marginLeft: 6, verticalAlign: "middle" }}
                  />
                )}
              </button>
            )}
          </div>

          {b.showOnbBadge && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
              }}
            >
              <a
                href="https://onb.app"
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center gap-2.5 px-3.5 py-1.5 rounded-full backdrop-blur-md border hover:-translate-y-0.5 transition-all duration-300 ${dark ? "bg-white/10 border-white/15 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4)]" : "bg-black/[0.05] border-black/[0.08] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.1)]"}`}
                style={{ textDecoration: "none" }}
              >
                <span className={`text-[10px] font-semibold uppercase tracking-[0.25em] transition-colors ${dark ? "text-white/40 group-hover:text-white/60" : "text-zinc-400 group-hover:text-zinc-500"}`}>
                  Powered by
                </span>
                <div className={`w-8 h-3.5 flex items-center justify-center group-hover:text-primary transition-colors duration-300 ${dark ? "text-white/80" : "text-zinc-900"}`}>
                  <svg viewBox="0 0 384 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <path
                      d="M55.2 157C44.4 157 34.8666 154.667 26.6 150C18.3333 145.2 11.8 138.667 6.99998 130.4C2.33331 122 -2.38717e-05 112.4 -2.38717e-05 101.6C-2.38717e-05 90.6667 2.33331 81.0667 6.99998 72.8C11.8 64.4 18.3333 57.8667 26.6 53.2C34.8666 48.4 44.4 46 55.2 46C65.8666 46 75.3333 48.4 83.6 53.2C91.8667 57.8667 98.3333 64.4 103 72.8C107.8 81.0667 110.2 90.6667 110.2 101.6C110.2 112.4 107.867 122 103.2 130.4C98.5333 138.667 92.0667 145.2 83.8 150C75.5333 154.667 66 157 55.2 157ZM55.2 139C62.1333 139 68.2666 137.4 73.6 134.2C78.9333 131 83.0666 126.6 86 121C89.0666 115.4 90.6 108.933 90.6 101.6C90.6 94.2667 89.0666 87.8 86 82.2C83.0666 76.4667 78.9333 72 73.6 68.8C68.2666 65.6 62.1333 64 55.2 64C48.2666 64 42.1333 65.6 36.8 68.8C31.4666 72 27.2666 76.4667 24.2 82.2C21.1333 87.8 19.6 94.2667 19.6 101.6C19.6 108.933 21.1333 115.4 24.2 121C27.2666 126.6 31.4666 131 36.8 134.2C42.1333 137.4 48.2666 139 55.2 139ZM214.961 156.4C212.028 156.4 209.561 155.467 207.561 153.6C205.694 151.6 204.761 149.133 204.761 146.2V97C204.761 89.4 203.361 83.2 200.561 78.4C197.761 73.6 193.961 70.0667 189.161 67.8C184.494 65.4 179.094 64.2 172.961 64.2C167.361 64.2 162.294 65.3333 157.761 67.6C153.228 69.8667 149.628 72.9333 146.961 76.8C144.294 80.5333 142.961 84.8667 142.961 89.8H130.361C130.361 81.4 132.361 73.9333 136.361 67.4C140.494 60.7333 146.094 55.4667 153.161 51.6C160.228 47.7333 168.161 45.8 176.961 45.8C186.161 45.8 194.361 47.8 201.561 51.8C208.894 55.6667 214.628 61.4 218.761 69C223.028 76.6 225.161 85.9333 225.161 97V146.2C225.161 149.133 224.161 151.6 222.161 153.6C220.294 155.467 217.894 156.4 214.961 156.4ZM132.761 156.4C129.828 156.4 127.361 155.467 125.361 153.6C123.494 151.6 122.561 149.133 122.561 146.2V57C122.561 53.9333 123.494 51.4667 125.361 49.6C127.361 47.7333 129.828 46.8 132.761 46.8C135.828 46.8 138.294 47.7333 140.161 49.6C142.028 51.4667 142.961 53.9333 142.961 57V146.2C142.961 149.133 142.028 151.6 140.161 153.6C138.294 155.467 135.828 156.4 132.761 156.4ZM295.889 157C285.489 157 276.156 154.6 267.889 149.8C259.622 144.867 253.089 138.2 248.289 129.8C243.489 121.4 241.022 111.933 240.889 101.4V10.2C240.889 7.13334 241.822 4.66667 243.689 2.80001C245.689 0.933342 248.156 8.58307e-06 251.089 8.58307e-06C254.156 8.58307e-06 256.622 0.933342 258.489 2.80001C260.356 4.66667 261.289 7.13334 261.289 10.2V64.2C265.956 58.6 271.556 54.2 278.089 51C284.756 47.6667 292.022 46 299.889 46C309.622 46 318.356 48.4667 326.089 53.4C333.822 58.2 339.889 64.8 344.289 73.2C348.822 81.4667 351.089 90.8667 351.089 101.4C351.089 111.933 348.622 121.4 343.689 129.8C338.889 138.2 332.356 144.867 324.089 149.8C315.822 154.6 306.422 157 295.889 157ZM295.889 139C302.689 139 308.756 137.4 314.089 134.2C319.422 130.867 323.622 126.333 326.689 120.6C329.889 114.867 331.489 108.467 331.489 101.4C331.489 94.2 329.889 87.8 326.689 82.2C323.622 76.6 319.422 72.2 314.089 69C308.756 65.6667 302.689 64 295.889 64C289.222 64 283.156 65.6667 277.689 69C272.356 72.2 268.156 76.6 265.089 82.2C262.022 87.8 260.489 94.2 260.489 101.4C260.489 108.467 262.022 114.867 265.089 120.6C268.156 126.333 272.356 130.867 277.689 134.2C283.156 137.4 289.222 139 295.889 139ZM369.314 159.4C365.581 159.4 362.314 158.067 359.514 155.4C356.847 152.6 355.514 149.333 355.514 145.6C355.514 141.733 356.847 138.467 359.514 135.8C362.314 133 365.581 131.6 369.314 131.6C373.181 131.6 376.447 133 379.114 135.8C381.781 138.467 383.114 141.733 383.114 145.6C383.114 149.333 381.781 152.6 379.114 155.4C376.447 158.067 373.181 159.4 369.314 159.4Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
