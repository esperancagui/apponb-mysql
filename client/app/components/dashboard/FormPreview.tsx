"use client";

import React, { useState, useEffect, useRef } from "react";
import { Form, FieldType } from "@/app/lib/types";
import {
  Upload,
  ChevronRight,
  MessageCircle,
  Instagram,
  Globe,
  CheckCircle2,
  Smartphone,
  Monitor,
  ExternalLink,
  Sparkles,
  Battery,
  Wifi,
  SignalHigh,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  generateTokens,
  generateRadii,
  getButtonStyle,
  getShadow,
  getGlassStyle,
  getTypography,
  withAlpha,
} from "@/app/lib/designSystem";

interface FormPreviewProps {
  form: Form;
}

const LOGO_SIZE_MAP: Record<string, { w: number; h: number }> = {
  small: { w: 48, h: 48 },
  medium: { w: 80, h: 80 },
  large: { w: 120, h: 120 },
  xlarge: { w: 160, h: 160 },
  xxlarge: { w: 200, h: 200 },
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

export default function FormPreview({ form }: FormPreviewProps) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [viewState, setViewState] = useState<"start" | "end">("start");
  const [scaleMode, setScaleMode] = useState<"fit" | "100">("fit");
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 400, h: 800 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const { branding: b, groups } = form;
  const t = generateTokens(b);
  const r = generateRadii(b);
  const ls = LOGO_SIZE_MAP[b.logoSize] || LOGO_SIZE_MAP.medium;

  const typo = getTypography(b);
  const shadow = getShadow(b);
  const glass = getGlassStyle(b, t);

  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
    const vmMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
    const lmMatch = url.match(/loom\.com\/share\/([\w-]+)/);
    if (lmMatch) return `https://www.loom.com/embed/${lmMatch[1]}`;
    return null;
  };

  const bgStyle: React.CSSProperties = {
    transition: "background 0.3s ease-in-out, background-color 0.3s ease-in-out, background-image 0.3s ease-in-out",
    ...(b.backgroundType === "gradient"
      ? { background: b.backgroundValue }
      : b.backgroundType === "pattern"
        ? { backgroundImage: `url(${b.backgroundValue})`, backgroundRepeat: "repeat" }
        : b.backgroundType === "image"
          ? {
              backgroundImage: `url(${b.backgroundValue})`,
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              backgroundAttachment: "fixed",
            }
          : { backgroundColor: t.bg }),
  };

  const heroType = b.headerStyle === "cover" ? b.heroBackgroundType || "none" : "none";
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
          : heroType === "video"
            ? { backgroundColor: "#000" } // Mock video poster
            : {};
  const hasHero = heroType !== "none" && b.heroBackgroundValue;

  const logoShape = b.logoShape || "natural";
  const logoBorder = b.logoBorder ?? false;
  const logoContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: b.logoMarginTop || 0,
    ...(logoShape === "circle" ? { borderRadius: "50%" } : {}),
    ...(logoShape === "square" ? { borderRadius: r.card } : {}),
    ...(logoShape === "natural"
      ? { width: ls.w, height: "auto" }
      : { width: ls.w, height: ls.h, backgroundColor: b.logoBgColor || "transparent" }),
    ...(logoBorder ? { border: `1px solid ${b.logoBorderColor || t.border}` } : {}),
  };

  const btnTokens = getButtonStyle(b, t);

  const getInputStyle = (): React.CSSProperties => {
    const customBg = b.inputColor || undefined;
    const base: React.CSSProperties = { height: 36, width: "100%", color: t.text };
    if (b.inputStyle === "outlined") {
      return {
        ...base,
        border: `1.5px solid ${t.border}`,
        backgroundColor: customBg || "transparent",
        borderRadius: r.input,
      };
    }
    if (b.inputStyle === "filled") {
      const fillBg = customBg || (t.isDark ? withAlpha("#ffffff", 0.06) : withAlpha("#000000", 0.04));
      return { ...base, backgroundColor: fillBg, border: "none", borderRadius: r.input };
    }
    return {
      ...base,
      borderBottom: `1.5px solid ${t.border}`,
      backgroundColor: customBg || "transparent",
      borderRadius: 0,
    };
  };
  const inputStyle = getInputStyle();

  const sectionGap = b.spacing === "compact" ? 14 : b.spacing === "spacious" ? 28 : 20;
  const fieldGap = b.spacing === "compact" ? 8 : b.spacing === "spacious" ? 16 : 12;

  const renderLogo = () => {
    let justifyContent = "center";
    if (b.logoPosition === "left") justifyContent = "flex-start";
    else if (b.logoPosition === "right") justifyContent = "flex-end";

    return (
      <div style={{ display: "flex", width: "100%", justifyContent }}>
        <div style={logoContainerStyle}>
          {b.logoUrl ? (
            <img
              src={b.logoUrl}
              alt="Logo"
              style={
                logoShape === "natural"
                  ? { maxWidth: ls.w, maxHeight: ls.h, display: "block" }
                  : { width: "100%", height: "100%", objectFit: "contain" }
              }
            />
          ) : (
            <span style={{ fontWeight: 700, color: t.primary, fontSize: ls.w * 0.4 }}>{b.businessName.charAt(0)}</span>
          )}
        </div>
      </div>
    );
  };

  const heroTextColor =
    b.heroTextColor || (heroType === "image" || heroType === "video" || heroType === "gradient" ? "#ffffff" : t.text);
  const heroSubColor =
    b.heroSubColor ||
    (heroType === "image" || heroType === "video" || heroType === "gradient"
      ? "rgba(255,255,255,0.9)"
      : t.textSecondary);

  // Device Dimensions
  const DEVICE_W = device === "desktop" ? 580 : 375;
  const DEVICE_H = device === "desktop" ? 720 : 740;

  const availableW = containerSize.w - (device === "desktop" ? 64 : 32);
  const availableH = containerSize.h - 160; // Room for control bar and padding

  const fitScale = Math.min(availableW / DEVICE_W, availableH / DEVICE_H);
  const computedScale = scaleMode === "fit" ? fitScale : 1;

  return (
    <div className="flex flex-col items-center w-full h-full relative" ref={containerRef}>
      {/* ─── Control Bar (Absolute Top) ─── */}
      <div className="absolute top-0 left-2 right-0 z-50 flex flex-col gap-2 p-2">
        <div className="flex items-center justify-between w-full max-w-lg mx-auto bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-black/5 dark:border-white/5 rounded-xl p-1.5 shadow-sm">
          {/* Device Toggle */}
          <div className="flex items-center bg-zinc-100/50 dark:bg-black/20 p-1 rounded-md">
            <button
              onClick={() => setDevice("mobile")}
              className={cn(
                "p-1.5 rounded-sm transition-all duration-200",
                device === "mobile"
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300",
              )}
            >
              <Smartphone size={14} />
            </button>
            <button
              onClick={() => setDevice("desktop")}
              className={cn(
                "p-1.5 rounded-sm transition-all duration-200 hidden lg:block",
                device === "desktop"
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300",
              )}
            >
              <Monitor size={14} />
            </button>
          </div>

          {/* State Toggle */}
          <div className="flex items-center bg-zinc-100/50 dark:bg-black/20 p-1 rounded-md mx-2 flex-1 justify-center max-w-[180px]">
            <button
              onClick={() => {
                setViewState("start");
                setCurrentGroupIndex(0);
              }}
              className={cn(
                "flex-1 px-3 py-1 rounded-sm text-[11px] font-semibold transition-all duration-200 whitespace-nowrap",
                viewState === "start"
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-white/5",
              )}
            >
              Form
            </button>
            <button
              onClick={() => setViewState("end")}
              className={cn(
                "flex-1 px-3 py-1 rounded-sm text-[11px] font-semibold transition-all duration-200 whitespace-nowrap",
                viewState === "end"
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-white/5",
              )}
            >
              Sucesso
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {device === "desktop" && (
              <>
                <button
                  onClick={() => setScaleMode((s) => (s === "fit" ? "100" : "fit"))}
                  className="px-2 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white uppercase tracking-wider"
                  title="Alternar entre Ajustar à tela / 100%"
                >
                  {scaleMode === "fit" ? "FIT" : "100%"}
                </button>
                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              title="Abrir em nova aba"
            >
              <ExternalLink size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── SCALED PREVIEW FRAME ─── */}
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden pointer-events-none">
        <div
          className={cn(
            "relative origin-center transition-all duration-500 ease-out shadow-2xl bg-white pointer-events-auto",
            device === "mobile"
              ? "border-[8px] border-[#1a1a1a] rounded-[40px] overflow-hidden"
              : "border border-zinc-200/80 dark:border-white/10 rounded-xl overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]",
          )}
          style={{
            width: DEVICE_W,
            height: DEVICE_H,
            transform: `scale(${computedScale})`,
          }}
        >
          {/* Mobile Status Bar area */}
          {device === "mobile" && (
            <>
              <div
                className="absolute top-0 left-0 right-0 h-[44px] z-50 flex items-center justify-between px-7"
                style={{
                  backgroundColor: withAlpha(t.bg, 0.85),
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                <span className="text-[14px] font-semibold text-black tracking-tight pt-1">9:41</span>
                <div className="flex items-center gap-1.5 opacity-90 text-black pt-1">
                  <SignalHigh size={15} strokeWidth={2.5} />
                  <Wifi size={15} strokeWidth={2.5} />
                  <Battery size={16} strokeWidth={2.5} className="ml-0.5" />
                </div>
              </div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[124px] h-[30px] bg-[#1a1a1a] rounded-b-[24px] z-50 pointer-events-none" />
            </>
          )}

          {/* Desktop Browser Bar */}
          {device === "desktop" && (
            <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 gap-2 z-50 relative shrink-0">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="mx-auto w-1/2 max-w-sm h-6 bg-white dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-md flex items-center justify-center text-[10px] text-zinc-400 font-mono">
                {form.slug ? `onb.app/f/${form.slug}` : "onb.app/f/preview"}
              </div>
            </div>
          )}

          {/* INNER CONTENT SCROLL CONTAINER (HIDES SCROLLBAR) */}
          <div
            className="w-full h-full overflow-y-auto no-scrollbar relative"
            style={{
              backgroundColor: t.bg,
              fontFamily: b.fontFamily,
              paddingTop: device === "desktop" ? 0 : 0,
            }}
          >
            {device === "mobile" && <div className="h-[44px] shrink-0" />}

            {/* Sticky Progress Bar */}
            {b.progressBarStyle && b.progressBarStyle !== "none" && viewState !== "end" && (
              <div
                style={{
                  width: "100%",
                  padding: "12px 24px",
                  backgroundColor: withAlpha(t.bg, 0.8),
                  backdropFilter: "blur(12px)",
                  borderBottom: `1px solid ${t.borderSubtle}`,
                  position: "sticky",
                  top: device === "mobile" ? 44 : 0,
                  zIndex: 40,
                }}
              >
                {b.progressBarStyle === "line" && (
                  <div style={{ height: 4, borderRadius: 2, backgroundColor: t.bgTertiary, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "40%", backgroundColor: t.primary, borderRadius: 2 }} />
                  </div>
                )}
                {b.progressBarStyle === "steps" && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {[1, 2, 3].map((s) => (
                      <div
                        key={s}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          backgroundColor: s === 1 ? t.primary : t.bgTertiary,
                          color: s === 1 ? t.textInverse : t.textMuted,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}
                {b.progressBarStyle === "percentage" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.bgTertiary, overflow: "hidden" }}
                    >
                      <div style={{ height: "100%", width: "40%", backgroundColor: t.primary, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>40%</span>
                  </div>
                )}
              </div>
            )}

            {/* Content Wrapper */}
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
              {/* Olay / Noise */}
              {b.backgroundNoise && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.05,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                />
              )}

              {/* View States */}
              {viewState === "end" ? (
                <div
                  style={{
                    ...bgStyle,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 32,
                    textAlign: "center",
                    gap: 20,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <CheckCircle2
                    style={{
                      width: device === "desktop" ? 80 : 64,
                      height: device === "desktop" ? 80 : 64,
                      color: t.primary,
                    }}
                  />
                  <div>
                    <h3
                      style={{
                        fontSize: device === "desktop" ? 32 : 24,
                        fontWeight: typo.titleWeight,
                        letterSpacing: typo.letterSpacing,
                        color: t.text,
                      }}
                    >
                      Obrigado!
                    </h3>
                    <p
                      style={{
                        fontSize: device === "desktop" ? 16 : 14,
                        color: t.textSecondary,
                        marginTop: 8,
                        maxWidth: 400,
                        lineHeight: 1.5,
                      }}
                    >
                      {b.thankYouMessage}
                    </p>
                  </div>

                  {b.showSocialOnSuccess !== false && typeof window !== "undefined" && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        alignItems: "center",
                        marginTop: 24,
                        width: "100%",
                        maxWidth: 320,
                      }}
                    >
                      {/* Enfatizar WhatsApp Redirecionamento */}
                      {b.whatsappNumber && (
                        <div
                          style={{
                            borderRadius: r.button,
                            backgroundColor: t.primary,
                            color: t.textInverse,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            padding: device === "desktop" ? "14px 24px" : "12px 20px",
                            width: "100%",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                          }}
                        >
                          <MessageCircle size={18} color="currentColor" />{" "}
                          <span style={{ fontSize: 14, fontWeight: 700, color: "currentColor" }}>
                            Falar no WhatsApp
                          </span>
                        </div>
                      )}

                      {/* Outros Sociais Menos Evidentes */}
                      <div
                        style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}
                      >
                        {b.instagramHandle && (
                          <div
                            className="transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                              borderRadius: r.button,
                              backgroundColor: t.bgElevated,
                              border: `1px solid ${t.borderSubtle}`,
                              boxShadow: `0 2px 10px ${t.isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)"}`,
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 16px 8px 8px",
                              cursor: "pointer",
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
                          </div>
                        )}
                        {b.websiteUrl && (
                          <div
                            className="transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                              borderRadius: r.button,
                              backgroundColor: t.bgElevated,
                              border: `1px solid ${t.borderSubtle}`,
                              boxShadow: `0 2px 10px ${t.isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)"}`,
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 16px 8px 8px",
                              cursor: "pointer",
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
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Powered by Briefin - Fixed at bottom of the flex container */}
                  <div
                    style={{
                      marginTop: 16,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <a
                      href="https://onb.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group flex items-center gap-2.5 px-3.5 py-1.5 rounded-full backdrop-blur-md border hover:-translate-y-0.5 transition-all duration-300 ${t.isDark ? "bg-white/10 border-white/15 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4)]" : "bg-black/[0.05] border-black/[0.08] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.1)]"}`}
                      style={{ textDecoration: "none" }}
                    >
                      <span className={`text-[10px] font-semibold uppercase tracking-[0.25em] transition-colors ${t.isDark ? "text-white/40 group-hover:text-white/60" : "text-zinc-400 group-hover:text-zinc-500"}`}>
                        Powered by
                      </span>
                      <div className={`w-8 h-3.5 flex items-center justify-center group-hover:text-primary transition-colors duration-300 ${t.isDark ? "text-white/80" : "text-zinc-900"}`}>
                        <svg
                          viewBox="0 0 384 160"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-full h-full"
                        >
                          <path
                            d="M55.2 157C44.4 157 34.8666 154.667 26.6 150C18.3333 145.2 11.8 138.667 6.99998 130.4C2.33331 122 -2.38717e-05 112.4 -2.38717e-05 101.6C-2.38717e-05 90.6667 2.33331 81.0667 6.99998 72.8C11.8 64.4 18.3333 57.8667 26.6 53.2C34.8666 48.4 44.4 46 55.2 46C65.8666 46 75.3333 48.4 83.6 53.2C91.8667 57.8667 98.3333 64.4 103 72.8C107.8 81.0667 110.2 90.6667 110.2 101.6C110.2 112.4 107.867 122 103.2 130.4C98.5333 138.667 92.0667 145.2 83.8 150C75.5333 154.667 66 157 55.2 157ZM55.2 139C62.1333 139 68.2666 137.4 73.6 134.2C78.9333 131 83.0666 126.6 86 121C89.0666 115.4 90.6 108.933 90.6 101.6C90.6 94.2667 89.0666 87.8 86 82.2C83.0666 76.4667 78.9333 72 73.6 68.8C68.2666 65.6 62.1333 64 55.2 64C48.2666 64 42.1333 65.6 36.8 68.8C31.4666 72 27.2666 76.4667 24.2 82.2C21.1333 87.8 19.6 94.2667 19.6 101.6C19.6 108.933 21.1333 115.4 24.2 121C27.2666 126.6 31.4666 131 36.8 134.2C42.1333 137.4 48.2666 139 55.2 139ZM214.961 156.4C212.028 156.4 209.561 155.467 207.561 153.6C205.694 151.6 204.761 149.133 204.761 146.2V97C204.761 89.4 203.361 83.2 200.561 78.4C197.761 73.6 193.961 70.0667 189.161 67.8C184.494 65.4 179.094 64.2 172.961 64.2C167.361 64.2 162.294 65.3333 157.761 67.6C153.228 69.8667 149.628 72.9333 146.961 76.8C144.294 80.5333 142.961 84.8667 142.961 89.8H130.361C130.361 81.4 132.361 73.9333 136.361 67.4C140.494 60.7333 146.094 55.4667 153.161 51.6C160.228 47.7333 168.161 45.8 176.961 45.8C186.161 45.8 194.361 47.8 201.561 51.8C208.894 55.6667 214.628 61.4 218.761 69C223.028 76.6 225.161 85.9333 225.161 97V146.2C225.161 149.133 224.161 151.6 222.161 153.6C220.294 155.467 217.894 156.4 214.961 156.4ZM132.761 156.4C129.828 156.4 127.361 155.467 125.361 153.6C123.494 151.6 122.561 149.133 122.561 146.2V57C122.561 53.9333 123.494 51.4667 125.361 49.6C127.361 47.7333 129.828 46.8 132.761 46.8C135.828 46.8 138.294 47.7333 140.161 49.6C142.028 51.4667 142.961 53.9333 142.961 57V146.2C142.961 149.133 142.028 151.6 140.161 153.6C138.294 155.467 135.828 156.4 132.761 156.4ZM295.889 157C285.489 157 276.156 154.6 267.889 149.8C259.622 144.867 253.089 138.2 248.289 129.8C243.489 121.4 241.022 111.933 240.889 101.4V10.2C240.889 7.13334 241.822 4.66667 243.689 2.80001C245.689 0.933342 248.156 8.58307e-06 251.089 8.58307e-06C254.156 8.58307e-06 256.622 0.933342 258.489 2.80001C260.356 4.66667 261.289 7.13334 261.289 10.2V64.2C265.956 58.6 271.556 54.2 278.089 51C284.756 47.6667 292.022 46 299.889 46C309.622 46 318.356 48.4667 326.089 53.4C333.822 58.2 339.889 64.8 344.289 73.2C348.822 81.4667 351.089 90.8667 351.089 101.4C351.089 111.933 348.622 121.4 343.689 129.8C338.889 138.2 332.356 144.867 324.089 149.8C315.822 154.6 306.422 157 295.889 157ZM295.889 139C302.689 139 308.756 137.4 314.089 134.2C319.422 130.867 323.622 126.333 326.689 120.6C329.889 114.867 331.489 108.467 331.489 101.4C331.489 94.2 329.889 87.8 326.689 82.2C323.622 76.6 319.422 72.2 314.089 69C308.756 65.6667 302.689 64 295.889 64C289.222 64 283.156 65.6667 277.689 69C272.356 72.2 268.156 76.6 265.089 82.2C262.022 87.8 260.489 94.2 260.489 101.4C260.489 108.467 262.022 114.867 265.089 120.6C268.156 126.333 272.356 130.867 277.689 134.2C283.156 137.4 289.222 139 295.889 139ZM369.314 159.4C365.581 159.4 362.314 158.067 359.514 155.4C356.847 152.6 355.514 149.333 355.514 145.6C355.514 141.733 356.847 138.467 359.514 135.8C362.314 133 365.581 131.6 369.314 131.6C373.181 131.6 376.447 133 379.114 135.8C381.781 138.467 383.114 141.733 383.114 145.6C383.114 149.333 381.781 152.6 379.114 155.4C376.447 158.067 373.181 159.4 369.314 159.4Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative", zIndex: 1 }}>
                  {/* HERO */}
                  {b.headerStyle === "cover" ? (
                    <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
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
                      <div
                        style={{
                          paddingLeft: 24,
                          paddingRight: 24,
                          paddingBottom: 24,
                          maxWidth: 672,
                          margin: "0 auto",
                          width: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: b.logoPosition === "center" ? "center" : "flex-start",
                          textAlign: b.logoPosition === "center" ? "center" : "left",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            ...logoContainerStyle,
                            marginTop: -(ls.w / 2 + 10),
                            minHeight: ls.w / 2 + 10,
                            ...(logoShape !== "natural" ? { border: `4px solid ${b.logoBorderColor || t.bg}` } : {}),
                            zIndex: 10,
                          }}
                        >
                          {b.logoUrl ? (
                            <img
                              src={b.logoUrl}
                              alt="Logo"
                              style={
                                logoShape === "natural"
                                  ? { maxWidth: ls.w, maxHeight: ls.h, display: "block" }
                                  : { width: "100%", height: "100%", objectFit: "contain" }
                              }
                            />
                          ) : (
                            <span style={{ fontWeight: 700, color: t.primary, fontSize: ls.w * 0.4 }}>
                              {b.businessName.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: 16 }}>
                          <h2
                            style={{
                              fontWeight: typo.titleWeight,
                              fontSize: device === "desktop" ? 30 : 24,
                              color: b.heroTextColor || t.text,
                              lineHeight: 1.25,
                              letterSpacing: typo.letterSpacing,
                            }}
                          >
                            {b.businessName}
                          </h2>
                          <p
                            style={{
                              fontSize: device === "desktop" ? 16 : 14,
                              lineHeight: 1.6,
                              fontWeight: 500,
                              color: b.heroSubColor || t.textSecondary,
                              maxWidth: 500,
                              marginTop: 8,
                            }}
                          >
                            {b.welcomeMessage}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : hasHero ? (
                    <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
                      <div
                        style={{
                          ...heroStyle,
                          minHeight: device === "desktop" ? 280 : 220,
                          padding: device === "desktop" ? "40px" : "32px 24px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: b.heroAlign === "left" ? "flex-start" : "center",
                          textAlign: b.heroAlign === "left" ? "left" : "center",
                          position: "relative",
                        }}
                      >
                        {/* Overlay */}
                        {(b.heroOverlayOpacity! > 0 || b.heroOverlayBlur! > 0) && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              backgroundColor: `rgba(0,0,0,${(b.heroOverlayOpacity || 0) / 100})`,
                              backdropFilter: `blur(${b.heroOverlayBlur || 0}px)`,
                            }}
                          />
                        )}

                        <div
                          style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: 16 }}
                        >
                          {b.headerStyle !== "minimal" && renderLogo()}
                          <div style={{ marginTop: 8 }}>
                            <h2
                              style={{
                                fontWeight: typo.titleWeight,
                                fontSize: device === "desktop" ? 36 : 28,
                                color: heroTextColor,
                                lineHeight: 1.2,
                                letterSpacing: typo.letterSpacing,
                              }}
                            >
                              {b.heroHeadline || b.businessName}
                            </h2>
                            <p
                              style={{
                                fontSize: device === "desktop" ? 16 : 14,
                                lineHeight: 1.6,
                                color: heroSubColor,
                                maxWidth: 500,
                                marginTop: 8,
                              }}
                            >
                              {b.heroSubtitle || b.welcomeMessage}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: device === "desktop" ? "48px 40px 24px" : "32px 24px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      {b.headerStyle !== "minimal" && renderLogo()}
                      <div
                        style={{
                          alignItems: b.headerStyle === "centered" ? "center" : "flex-start",
                          textAlign: b.headerStyle === "centered" ? "center" : "left",
                        }}
                      >
                        <h2
                          style={{
                            fontWeight: typo.titleWeight,
                            fontSize: device === "desktop" ? 32 : 24,
                            color: t.text,
                            lineHeight: 1.2,
                            letterSpacing: typo.letterSpacing,
                          }}
                        >
                          {b.businessName}
                        </h2>
                        <p
                          style={{
                            fontSize: device === "desktop" ? 16 : 14,
                            lineHeight: 1.6,
                            color: t.textSecondary,
                            maxWidth: device === "desktop" ? 600 : "100%",
                            marginTop: 8,
                          }}
                        >
                          {b.welcomeMessage}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* FORM BODY */}
                  <div
                    style={{
                      ...bgStyle,
                      flex: 1,
                      padding: device === "desktop" ? `0 40px 60px` : `0 24px 40px`,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: b.formWidth === "narrow" ? 540 : b.formWidth === "wide" ? 800 : 640,
                        margin:
                          b.formWidth === "narrow" || b.formWidth === "medium" || device === "mobile" ? "0 auto" : "0",
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        gap: sectionGap,
                        paddingTop: 24,
                      }}
                    >
                      {/* Vídeo */}
                      {b.welcomeVideoPosition === "top" &&
                        b.welcomeVideoUrl &&
                        getEmbedUrl(b.welcomeVideoUrl) &&
                        currentGroupIndex === 0 && (
                          <div
                            style={{
                              aspectRatio: "16/9",
                              backgroundColor: t.bgElevated,
                              borderRadius: r.card,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              outline: `1px solid ${t.borderSubtle}`,
                              ...glass,
                              marginBottom: 12,
                            }}
                          >
                            <span style={{ fontSize: 13, color: t.textMuted }}>Video Player Placeholder</span>
                          </div>
                        )}

                      {groups[currentGroupIndex] && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: fieldGap,
                            padding: b.sectionDivider === "card" ? 24 : 0,
                            backgroundColor: b.sectionDivider === "card" ? t.bgElevated : "transparent",
                            borderRadius: b.sectionDivider === "card" ? r.card : 0,
                            boxShadow: b.sectionDivider === "card" && shadow !== "none" ? shadow : undefined,
                          }}
                        >
                          {b.sectionDivider === "number" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
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
                                {currentGroupIndex + 1}
                              </div>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.1em",
                                  color: t.textSecondary,
                                }}
                              >
                                {groups[currentGroupIndex].name}
                              </span>
                            </div>
                          ) : b.sectionDivider === "accordion" ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "16px 20px",
                                backgroundColor: t.bgElevated,
                                borderRadius: r.card,
                                border: `1px solid ${t.border}`,
                                cursor: "pointer",
                                marginBottom: 8,
                              }}
                            >
                              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                                {groups[currentGroupIndex].name}
                              </span>
                              <ChevronRight size={16} style={{ color: t.textMuted, transform: "rotate(90deg)" }} />
                            </div>
                          ) : (
                            <p
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.15em",
                                color: t.textSecondary,
                                marginBottom: 4,
                              }}
                            >
                              {groups[currentGroupIndex].name}
                            </p>
                          )}

                          {(groups[currentGroupIndex].fields ?? []).map((field) => (
                            <div key={field.id} style={{ marginBottom: 4 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>
                                {field.label ? renderFormattedText(field.label) : null}
                                {field.required && <span style={{ color: t.error, marginLeft: 4 }}>*</span>}
                              </p>
                              {field.type === FieldType.FILE ? (
                                <div
                                  style={{
                                    height: 100,
                                    border: `1.5px dashed ${t.border}`,
                                    borderRadius: r.card,
                                    backgroundColor: t.bgSecondary,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                  }}
                                >
                                  <Upload size={18} style={{ color: t.textMuted }} />
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                      color: t.textMuted,
                                    }}
                                  >
                                    Arraste ou clique
                                  </span>
                                </div>
                              ) : field.type === FieldType.TEXTAREA ? (
                                <div style={{ ...inputStyle, height: 100, borderRadius: r.card }} />
                              ) : field.type === FieldType.SELECT ? (
                                <div
                                  style={{
                                    ...inputStyle,
                                    height: 44,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "0 16px",
                                  }}
                                >
                                  <span style={{ fontSize: 14, color: t.textMuted }}>Selecione...</span>
                                  <ChevronRight size={14} style={{ color: t.textMuted, transform: "rotate(90deg)" }} />
                                </div>
                              ) : (
                                <div style={{ ...inputStyle, height: 44 }} />
                              )}
                              {field.description && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 8,
                                    padding: 12,
                                    marginTop: 8,
                                    border: `1px solid ${t.borderSubtle}`,
                                    borderRadius: r.card,
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
                          ))}
                        </div>
                      )}

                      <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 12 }}>
                        {currentGroupIndex > 0 && (
                          <button
                            onClick={() => setCurrentGroupIndex((i) => Math.max(0, i - 1))}
                            style={{
                              ...btnTokens,
                              backgroundColor: t.bgElevated,
                              color: t.text,
                              borderRadius: r.button,
                              flex: 1,
                              padding: "16px 0",
                              fontSize: 15,
                              fontWeight: 700,
                              border: `1px solid ${t.border}`,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                            }}
                          >
                            Anterior
                          </button>
                        )}

                        {currentGroupIndex < groups.length - 1 ? (
                          <button
                            onClick={() => setCurrentGroupIndex((i) => Math.min(groups.length - 1, i + 1))}
                            style={{
                              ...btnTokens,
                              borderRadius: r.button,
                              flex: 2,
                              padding: "16px 0",
                              fontSize: 15,
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                            }}
                          >
                            Próxima
                            <ChevronRight size={16} />
                          </button>
                        ) : (
                          <button
                            style={{
                              ...btnTokens,
                              borderRadius: r.button,
                              flex: 2,
                              padding: "16px 0",
                              fontSize: 15,
                              fontWeight: 700,
                              border: "none",
                              cursor: "default",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                            }}
                          >
                            {b.submitButtonText || "Enviar"}
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>

                      {/* {b.showOnbBadge && ( */}
                      <div
                        style={{
                          marginTop: 12,
                          paddingBottom: 12,
                          display: "flex",
                          justifyContent: "center",
                        }}
                      >
                        <a
                          href="https://onb.app"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`group flex items-center gap-2.5 px-3.5 py-1.5 rounded-full backdrop-blur-md border hover:-translate-y-0.5 transition-all duration-300 ${t.isDark ? "bg-white/10 border-white/15 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4)]" : "bg-black/[0.05] border-black/[0.08] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.1)]"}`}
                          style={{ textDecoration: "none" }}
                        >
                          <span className={`text-[10px] font-semibold uppercase tracking-[0.25em] transition-colors ${t.isDark ? "text-white/40 group-hover:text-white/60" : "text-zinc-400 group-hover:text-zinc-500"}`}>
                            Powered by
                          </span>
                          <div className={`w-8 h-3.5 flex items-center justify-center group-hover:text-primary transition-colors duration-300 ${t.isDark ? "text-white/80" : "text-zinc-900"}`}>
                            <svg
                              viewBox="0 0 384 160"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-full h-full"
                            >
                              <path
                                d="M55.2 157C44.4 157 34.8666 154.667 26.6 150C18.3333 145.2 11.8 138.667 6.99998 130.4C2.33331 122 -2.38717e-05 112.4 -2.38717e-05 101.6C-2.38717e-05 90.6667 2.33331 81.0667 6.99998 72.8C11.8 64.4 18.3333 57.8667 26.6 53.2C34.8666 48.4 44.4 46 55.2 46C65.8666 46 75.3333 48.4 83.6 53.2C91.8667 57.8667 98.3333 64.4 103 72.8C107.8 81.0667 110.2 90.6667 110.2 101.6C110.2 112.4 107.867 122 103.2 130.4C98.5333 138.667 92.0667 145.2 83.8 150C75.5333 154.667 66 157 55.2 157ZM55.2 139C62.1333 139 68.2666 137.4 73.6 134.2C78.9333 131 83.0666 126.6 86 121C89.0666 115.4 90.6 108.933 90.6 101.6C90.6 94.2667 89.0666 87.8 86 82.2C83.0666 76.4667 78.9333 72 73.6 68.8C68.2666 65.6 62.1333 64 55.2 64C48.2666 64 42.1333 65.6 36.8 68.8C31.4666 72 27.2666 76.4667 24.2 82.2C21.1333 87.8 19.6 94.2667 19.6 101.6C19.6 108.933 21.1333 115.4 24.2 121C27.2666 126.6 31.4666 131 36.8 134.2C42.1333 137.4 48.2666 139 55.2 139ZM214.961 156.4C212.028 156.4 209.561 155.467 207.561 153.6C205.694 151.6 204.761 149.133 204.761 146.2V97C204.761 89.4 203.361 83.2 200.561 78.4C197.761 73.6 193.961 70.0667 189.161 67.8C184.494 65.4 179.094 64.2 172.961 64.2C167.361 64.2 162.294 65.3333 157.761 67.6C153.228 69.8667 149.628 72.9333 146.961 76.8C144.294 80.5333 142.961 84.8667 142.961 89.8H130.361C130.361 81.4 132.361 73.9333 136.361 67.4C140.494 60.7333 146.094 55.4667 153.161 51.6C160.228 47.7333 168.161 45.8 176.961 45.8C186.161 45.8 194.361 47.8 201.561 51.8C208.894 55.6667 214.628 61.4 218.761 69C223.028 76.6 225.161 85.9333 225.161 97V146.2C225.161 149.133 224.161 151.6 222.161 153.6C220.294 155.467 217.894 156.4 214.961 156.4ZM132.761 156.4C129.828 156.4 127.361 155.467 125.361 153.6C123.494 151.6 122.561 149.133 122.561 146.2V57C122.561 53.9333 123.494 51.4667 125.361 49.6C127.361 47.7333 129.828 46.8 132.761 46.8C135.828 46.8 138.294 47.7333 140.161 49.6C142.028 51.4667 142.961 53.9333 142.961 57V146.2C142.961 149.133 142.028 151.6 140.161 153.6C138.294 155.467 135.828 156.4 132.761 156.4ZM295.889 157C285.489 157 276.156 154.6 267.889 149.8C259.622 144.867 253.089 138.2 248.289 129.8C243.489 121.4 241.022 111.933 240.889 101.4V10.2C240.889 7.13334 241.822 4.66667 243.689 2.80001C245.689 0.933342 248.156 8.58307e-06 251.089 8.58307e-06C254.156 8.58307e-06 256.622 0.933342 258.489 2.80001C260.356 4.66667 261.289 7.13334 261.289 10.2V64.2C265.956 58.6 271.556 54.2 278.089 51C284.756 47.6667 292.022 46 299.889 46C309.622 46 318.356 48.4667 326.089 53.4C333.822 58.2 339.889 64.8 344.289 73.2C348.822 81.4667 351.089 90.8667 351.089 101.4C351.089 111.933 348.622 121.4 343.689 129.8C338.889 138.2 332.356 144.867 324.089 149.8C315.822 154.6 306.422 157 295.889 157ZM295.889 139C302.689 139 308.756 137.4 314.089 134.2C319.422 130.867 323.622 126.333 326.689 120.6C329.889 114.867 331.489 108.467 331.489 101.4C331.489 94.2 329.889 87.8 326.689 82.2C323.622 76.6 319.422 72.2 314.089 69C308.756 65.6667 302.689 64 295.889 64C289.222 64 283.156 65.6667 277.689 69C272.356 72.2 268.156 76.6 265.089 82.2C262.022 87.8 260.489 94.2 260.489 101.4C260.489 108.467 262.022 114.867 265.089 120.6C268.156 126.333 272.356 130.867 277.689 134.2C283.156 137.4 289.222 139 295.889 139ZM369.314 159.4C365.581 159.4 362.314 158.067 359.514 155.4C356.847 152.6 355.514 149.333 355.514 145.6C355.514 141.733 356.847 138.467 359.514 135.8C362.314 133 365.581 131.6 369.314 131.6C373.181 131.6 376.447 133 379.114 135.8C381.781 138.467 383.114 141.733 383.114 145.6C383.114 149.333 381.781 152.6 379.114 155.4C376.447 158.067 373.181 159.4 369.314 159.4Z"
                                fill="currentColor"
                              />
                            </svg>
                          </div>
                        </a>
                      </div>
                      {/* )} */}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Home indicator */}
          {device === "mobile" && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 rounded-full bg-black/80 dark:bg-white/80 z-50 pointer-events-none" />
          )}
        </div>
      </div>
    </div>
  );
}
