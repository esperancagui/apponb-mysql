/**
 * Smart Design System — Derives a complete visual palette from user's chosen colors.
 * Instead of hardcoded dark/light values, everything is computed from the branding.
 */

import { BrandingConfig } from "./types";

/* ═══════════════════════════════════════
   COLOR UTILITIES
   ═══════════════════════════════════════ */

/** Parse hex to RGB */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [parseInt(full.substring(0, 2), 16), parseInt(full.substring(2, 4), 16), parseInt(full.substring(4, 6), 16)];
}

/** RGB to hex */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** Get relative luminance (0 = black, 1 = white) */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Is this color dark? */
export function isDark(hex: string): boolean {
  return luminance(hex) < 0.4;
}

/** Lighten a color */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Darken a color */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Mix two colors */
function mix(c1: string, c2: string, weight: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(r1 * weight + r2 * (1 - weight), g1 * weight + g2 * (1 - weight), b1 * weight + b2 * (1 - weight));
}

/** Add alpha to hex color */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ═══════════════════════════════════════
   DESIGN TOKEN GENERATOR
   ═══════════════════════════════════════ */

export interface DesignTokens {
  // Background layers
  bg: string; // Page background
  bgSecondary: string; // Cards, sections
  bgTertiary: string; // Inputs, hover states
  bgElevated: string; // Modals, dropdowns

  // Text
  text: string; // Primary text
  textSecondary: string; // Labels, descriptions
  textMuted: string; // Placeholders, hints
  textInverse: string; // Text on primary color

  // Borders
  border: string; // Default borders
  borderSubtle: string; // Very subtle dividers
  borderFocus: string; // Focus ring color

  // Primary
  primary: string; // Primary brand color
  primaryHover: string; // Primary hover state
  primarySoft: string; // Soft/light primary (badges, tags)
  primaryMuted: string; // Very subtle primary wash

  // Accent
  accent: string;
  accentSoft: string;

  // Semantic
  error: string;
  errorSoft: string;

  // State
  isDark: boolean;

  // CSS custom properties for inline use
  asCSSVars: Record<string, string>;
}

/**
 * Generate a complete set of design tokens from BrandingConfig.
 * The magic: everything is derived from primaryColor + backgroundValue.
 */
export function generateTokens(branding: BrandingConfig): DesignTokens {
  const primary = branding.primaryColor;
  const accent = branding.accentColor || lighten(primary, 0.2);

  // Detect if background is dark by extracting the solid color
  let originalBgBase = "#ffffff";
  if (branding.backgroundType === "solid") {
    originalBgBase = branding.backgroundValue || "#ffffff";
  } else if (branding.backgroundType === "gradient") {
    // Extract first color from gradient
    const match = branding.backgroundValue.match(/#[0-9a-fA-F]{3,8}/);
    if (match) originalBgBase = match[0];
  }

  let dark = false;
  let bgBase = originalBgBase;

  // Determine dark mode
  if (branding.darkMode === "auto") {
    dark = isDark(bgBase);
  } else {
    dark = branding.darkMode === true;

    // Smart adaptation: If Dark Mode is ON but bg is light, mix it strongly with dark zinc.
    // If Light Mode is ON but bg is dark, mix it strongly with white.
    // This ensures explicit "solid" backgrounds still respect the mode without breaking contrast.
    const bgIsDark = isDark(originalBgBase);
    if (dark && !bgIsDark && branding.backgroundType === "solid") {
      bgBase = mix("#09090b", originalBgBase, 0.92); // 92% dark zinc, 8% user color
    } else if (!dark && bgIsDark && branding.backgroundType === "solid") {
      bgBase = mix("#ffffff", originalBgBase, 0.92); // 92% white, 8% user color
    }
  }

  // Generate palette — use neutral mixing to avoid inheriting color casts
  const bg = bgBase;
  const bgSecondary = dark ? lighten(bgBase, 0.06) : mix("#808080", bgBase, 0.03);
  const bgTertiary = dark ? lighten(bgBase, 0.1) : mix("#808080", bgBase, 0.06);
  const bgElevated = dark ? lighten(bgBase, 0.08) : "#ffffff";

  const text = branding.textColor || (dark ? lighten(bgBase, 0.9) : darken(bgBase, 0.85));
  const textSecondary = dark ? withAlpha(text, 0.7) : withAlpha(text, 0.6);
  const textMuted = dark ? withAlpha(text, 0.45) : withAlpha(text, 0.35);
  const textInverse = isDark(primary) ? "#ffffff" : "#000000";

  const border = dark ? lighten(bgBase, 0.15) : darken(bgBase, 0.1);
  const borderSubtle = dark ? lighten(bgBase, 0.08) : darken(bgBase, 0.05);
  const borderFocus = primary;

  const primaryHover = dark ? lighten(primary, 0.15) : darken(primary, 0.1);
  const primarySoft = dark ? withAlpha(primary, 0.2) : lighten(primary, 0.85);
  const primaryMuted = dark ? withAlpha(primary, 0.06) : withAlpha(primary, 0.04);

  const accentSoft = dark ? withAlpha(accent, 0.15) : lighten(accent, 0.85);

  const error = "#ef4444";
  const errorSoft = dark ? "rgba(239,68,68,0.15)" : "#fef2f2";

  return {
    bg,
    bgSecondary,
    bgTertiary,
    bgElevated,
    text,
    textSecondary,
    textMuted,
    textInverse,
    border,
    borderSubtle,
    borderFocus,
    primary,
    primaryHover,
    primarySoft,
    primaryMuted,
    accent,
    accentSoft,
    error,
    errorSoft,
    isDark: dark,
    asCSSVars: {
      "--ds-bg": bg,
      "--ds-bg-secondary": bgSecondary,
      "--ds-bg-tertiary": bgTertiary,
      "--ds-text": text,
      "--ds-text-secondary": textSecondary,
      "--ds-text-muted": textMuted,
      "--ds-border": border,
      "--ds-border-subtle": borderSubtle,
      "--ds-primary": primary,
      "--ds-primary-soft": primarySoft,
      "--ds-accent": accent,
    },
  };
}

/* ═══════════════════════════════════════
   RADIUS SYSTEM
   ═══════════════════════════════════════ */

const RADIUS_VALUES: Record<string, number> = {
  none: 0,
  small: 6,
  medium: 12,
  large: 20,
  full: 9999,
};

export interface RadiusTokens {
  button: string;
  input: string;
  card: string;
  badge: string;
}

export function generateRadii(branding: BrandingConfig): RadiusTokens {
  const base = RADIUS_VALUES[branding.borderRadius] ?? 12;
  const buttonR = RADIUS_VALUES[branding.buttonRadius || branding.borderRadius] ?? base;
  const inputR = RADIUS_VALUES[branding.inputRadius || branding.borderRadius] ?? base;
  const cardR = RADIUS_VALUES[branding.cardRadius || branding.borderRadius] ?? base;

  return {
    button: `${buttonR}px`,
    input: `${inputR}px`,
    card: `${Math.min(cardR, 24)}px`,
    badge: `${Math.min(base, 12)}px`,
  };
}

/* ═══════════════════════════════════════
   BUTTON STYLE GENERATOR
   ═══════════════════════════════════════ */

export function getButtonStyle(branding: BrandingConfig, tokens: DesignTokens): React.CSSProperties {
  switch (branding.buttonStyle) {
    case "filled":
      return { backgroundColor: tokens.primary, color: tokens.textInverse };
    case "outline":
      return { backgroundColor: "transparent", border: `2px solid ${tokens.primary}`, color: tokens.primary };
    case "soft":
      return { backgroundColor: tokens.primarySoft, color: tokens.primary };
    case "gradient":
      return { background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`, color: tokens.textInverse };
    default:
      return { backgroundColor: tokens.primary, color: tokens.textInverse };
  }
}

/* ═══════════════════════════════════════
   INPUT STYLE GENERATOR
   ═══════════════════════════════════════ */

export function getInputStyle(branding: BrandingConfig, tokens: DesignTokens): React.CSSProperties {
  const customBg = branding.inputColor || undefined;
  // Se tem cor de fundo customizada mas não tem texto, decide se usa branco ou preto baseado na luminância
  const customText = branding.inputTextColor || (customBg ? (isDark(customBg) ? "#ffffff" : "#18181b") : undefined);

  switch (branding.inputStyle) {
    case "outlined":
      return {
        backgroundColor: customBg || "transparent",
        border: `1.5px solid ${tokens.border}`,
        color: customText || tokens.text,
      };
    case "filled":
      return {
        backgroundColor: customBg || (tokens.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
        border: "none",
        color: customText || tokens.text,
      };
    case "underline":
      return {
        backgroundColor: customBg || "transparent",
        border: "none",
        borderBottom: `2px solid ${tokens.border}`,
        borderRadius: 0,
        color: customText || tokens.text,
      };
    default:
      return {
        backgroundColor: customBg || "transparent",
        border: `1.5px solid ${tokens.border}`,
        color: customText || tokens.text,
      };
  }
}

/* ═══════════════════════════════════════
   SHADOW SYSTEM
   ═══════════════════════════════════════ */

export function getShadow(branding: BrandingConfig): string {
  switch (branding.boxShadow) {
    case "soft":
      return "0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)";
    case "sharp":
      return "0 4px 12px rgba(0,0,0,0.12)";
    case "deep":
      return "0 8px 30px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)";
    case "none":
    default:
      return "none";
  }
}

export function getGlassStyle(branding: BrandingConfig, tokens: DesignTokens): React.CSSProperties {
  if (!branding.glassmorphism) return {};
  return {
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    backgroundColor: tokens.isDark ? "rgba(30,30,30,0.7)" : "rgba(255,255,255,0.7)",
    border: `1px solid ${tokens.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
  };
}

/* ═══════════════════════════════════════
   TYPOGRAPHY TOKENS
   ═══════════════════════════════════════ */

export interface TypographyTokens {
  letterSpacing: string;
  titleWeight: number;
}

export function getTypography(branding: BrandingConfig): TypographyTokens {
  const lsMap: Record<string, string> = { tight: "-0.02em", normal: "0", wide: "0.04em" };
  const twMap: Record<string, number> = { semibold: 600, bold: 700, extrabold: 800 };
  return {
    letterSpacing: lsMap[branding.letterSpacing || "normal"] || "0",
    titleWeight: twMap[branding.titleWeight || "bold"] || 700,
  };
}
