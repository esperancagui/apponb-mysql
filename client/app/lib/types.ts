/* ═══════════════════════════════════════
   onb. — Domain Types
   Pronto para backend: todas as interfaces
   espelham os contratos de API esperados.
   ═══════════════════════════════════════ */

// ──────────────────────────────────────
// Field & Form Builder
// ──────────────────────────────────────

export enum FieldType {
  TEXT = "text",
  TEXTAREA = "textarea",
  SELECT = "select",
  EMAIL = "email",
  PHONE = "phone",
  FILE = "file",
  SCALE = "scale",
}

export interface FileValidation {
  allowedTypes?: string[];
  maxSizeMB?: number;
  minWidth?: number;
  minHeight?: number;
}

export interface FieldGroup {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // Para SELECT
  mask?: "cpf" | "cnpj" | "phone" | "cep" | "currency" | "date" | "none";
  scaleMin?: number; // Para SCALE
  scaleMax?: number; // Para SCALE
  scaleMinLabel?: string; // Para SCALE (ex: "Discordo totalmente")
  scaleMaxLabel?: string; // Para SCALE (ex: "Concordo totalmente")
  fileValidation?: FileValidation;
  description?: string; // IA Tip
  dependsOn?: string; // ID do campo (tipo SELECT) que controla exibição deste campo
  dependsOnValue?: string; // Valor do campo originador necessário pra exibir este
}

// ──────────────────────────────────────
// Branding & Visual Config
// ──────────────────────────────────────

export interface BrandingConfig {
  // ── Cores ──
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  textColor?: string; // Cor principal do texto do formulário
  inputColor?: string; // Cor de fundo dos inputs
  inputTextColor?: string; // Cor do texto dentro dos inputs
  logoBorderColor?: string; // Cor da borda da logo (quando recortada)
  logoBgColor?: string; // Cor de fundo da logo (quando recortada)
  tipColor?: string; // Cor de fundo das dicas
  tipTextColor?: string; // Cor do texto das dicas

  // ── Background ──
  backgroundType: "solid" | "gradient" | "image" | "pattern";
  backgroundValue: string;
  backgroundNoise?: boolean;

  // ── Identidade ──
  businessName: string;
  logoUrl?: string;
  logoDarkModeUrl?: string;
  logoSize: "small" | "medium" | "large" | "xlarge" | "xxlarge";
  logoShape: "square" | "circle" | "natural";
  logoBorder: boolean;
  logoPosition: "left" | "center" | "right";
  logoMarginTop?: number;
  logoStyle?: "top" | "floating";

  // ── Hero / Cabeçalho ──
  heroBackgroundType: "none" | "solid" | "gradient" | "image" | "video";
  heroBackgroundValue: string;
  heroOverlayOpacity?: number;
  heroOverlayBlur?: number;
  heroHeadline?: string;
  heroSubtitle?: string;
  heroAlign?: "left" | "center";
  showLogoInHero?: boolean;
  heroBackgroundSize?: "cover" | "contain";
  heroBackgroundPosition?: "center" | "top" | "bottom";
  heroTextColor?: string;
  heroSubColor?: string;

  // ── Tipografia ──
  fontFamily: "Inter" | "Poppins" | "Playfair Display" | "Roboto" | "Outfit" | "DM Sans" | "Space Grotesk" | "Sora";
  letterSpacing?: "tight" | "normal" | "wide";
  titleWeight?: "semibold" | "bold" | "extrabold";

  // ── Estilo Visual ──
  borderRadius: "none" | "small" | "medium" | "large" | "full";
  buttonRadius?: "none" | "small" | "medium" | "large" | "full";
  inputRadius?: "none" | "small" | "medium" | "large" | "full";
  cardRadius?: "none" | "small" | "medium" | "large" | "full";
  buttonStyle: "filled" | "outline" | "soft" | "gradient";
  inputStyle: "underline" | "outlined" | "filled";
  spacing: "compact" | "comfortable" | "spacious";
  boxShadow?: "none" | "soft" | "sharp" | "deep";
  glassmorphism?: boolean;

  // ── Layout ──
  headerStyle: "centered" | "left" | "minimal" | "hero" | "cover";
  formWidth: "narrow" | "medium" | "wide";
  sectionDivider: "line" | "space" | "number" | "accordion" | "card" | "none";
  progressBarStyle?: "none" | "line" | "steps" | "percentage";

  // ── Recursos ──
  darkMode: boolean | "auto";
  animationStyle: "none" | "subtle" | "expressive";
  microinteractions?: boolean;
  showOnbBadge: boolean;
  submitButtonText: string;

  // ── SEO & Meta ──
  seoTitle?: string;
  seoDescription?: string;
  seoThumbnailUrl?: string;
  faviconUrl?: string;

  // ── Conteúdo ──
  welcomeMessage: string;
  thankYouMessage: string;
  coverImageUrl?: string;
  welcomeVideoUrl?: string;
  welcomeVideoPosition?: "top" | "hero";

  // ── Social & Contato ──
  whatsappNumber?: string;
  instagramHandle?: string;
  websiteUrl?: string;
  showSocialOnSuccess?: boolean;

  // ── IA ──
  aiTone?: "executive" | "friendly" | "minimal";
}

// ──────────────────────────────────────
// Form Template
// ──────────────────────────────────────

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags?: string[];
  questionCount?: number;
  sectionCount?: number;
  defaultGroups: FieldGroup[];
  defaultBranding: BrandingConfig;
  /** True for built-in system templates — read-only, cannot be edited or deleted */
  isSystem?: boolean;
}

// ──────────────────────────────────────
// Form
// ──────────────────────────────────────

export type FormStatus = "active" | "draft" | "archived";

export interface Form {
  id: string;
  slug: string;
  name: string;
  clientName?: string; // The specific client this form was created for
  templateId?: string;
  category?: string;
  folderId?: string;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
  groups: FieldGroup[];
  branding: BrandingConfig;
  status: FormStatus;
  submissionCount?: number;
  lastSubmissionAt?: string;
}

// ──────────────────────────────────────
// Submission
// ──────────────────────────────────────

export interface Submission {
  id: string;
  formId: string;
  workspaceId?: string;
  submittedAt: string;
  data: Record<string, any>;
  files?: Record<string, string[]>;
}

// ──────────────────────────────────────
// Inbox / Triagem (Dashboard)
// ──────────────────────────────────────

export type InboxStatus = "new" | "reviewing" | "pending" | "reviewed" | "archived";
export type AIRiskLevel = "low" | "medium" | "high";

export interface InboxItem {
  id: string;
  formId: string;
  formName: string;
  clientName: string;
  clientAvatarUrl?: string;
  summary: string;
  submittedAt: string;
  status: InboxStatus;
  attachments: number;
  attachmentsOk: number;
  aiRisk: AIRiskLevel;
  vip: boolean;
  aiInsightId?: string;
  data?: Record<string, any>; // raw submission answers
  files?: Record<string, string[]>; // field ID → array of Firebase Storage URLs
  formGroups?: FieldGroup[]; // snapshotted form field definitions (when form is deleted)
}

// ──────────────────────────────────────
// AI Insights
// ──────────────────────────────────────

export interface RedFlagEstrategica {
  alerta: string;
  impactoNoNegocio: string;
  severidade: "Alta" | "Média" | "Baixa";
  recomendacao: string;
}

export interface AIInsight {
  id: string;
  submissionId: string;
  headerImpacto: {
    headline: string;
    status: "Ready to Pitch" | "Needs Deep Dive" | "High Alert";
  };
  diagnosticoEstrategico: {
    visaoGeral: string;
    dorDoCliente: string;
    potencialDeLucro: string;
  };
  scoreONB: {
    pontuacao: number;
    classificacao: "Crítico" | "Regular" | "Premium";
    analiseTecnica: string;
  };
  redFlagsEstrategicas: RedFlagEstrategica[];
  perfilPsicografico: {
    perfil: string;
    estrategaDeVenda: string;
  };
  kickoffMasterlist: {
    perguntasDeOuro: string[];
    proximoPasso: string;
  };
  // Agency-only sections
  auditVisual?: {
    consistenciaComBriefing: string;
    maturidadeDaMarca: string;
    observacoes: string[];
    oportunidades: string[];
    scoreVisual: number;
  };
  estrategiaDeProtecao?: {
    nivelDeRisco: "Alto" | "Médio" | "Baixo";
    alertaDeEscopo: string;
    clausulasRecomendadas: string[];
    sinaisDeAlerta: string[];
  };
}

// ──────────────────────────────────────
// File Assets (Validação de arquivos)
// ──────────────────────────────────────

export type FileAssetStatus = "validated" | "partial" | "rejected";

export interface FileAsset {
  id: string;
  submissionId: string;
  name: string;
  size: string;
  mimeType?: string;
  url?: string;
  status: FileAssetStatus;
  message?: string;
}

// ──────────────────────────────────────
// User & Workspace
// ──────────────────────────────────────

export type UserRole = "owner" | "admin" | "member" | "viewer";
export type PlanTier = "free" | "basic" | "premium";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  photo_url?: string;
  firebase_uid: string;
  created_at: string;
  email_notifications?: boolean;
  language?: string;
  plan?: "free" | "basic" | "premium";
  subscription_status?: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  current_period_end?: string;
  trial_end?: string;
}

export interface BillingSubscription {
  plan: "free" | "basic" | "premium";
  subscription_status?: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  trial_end?: string;
  current_period_end?: string;
  next_invoice_amount?: number;
  next_invoice_currency?: string;
}

export interface Invoice {
  id: string;
  date: number;
  amount: number;
  currency: string;
  status?: string;
  pdf_url?: string;
  description?: string;
}

export interface WorkspaceMember {
  uid: string;
  role: UserRole;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Folder {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  brandColor?: string;
  plan: PlanTier;
  members: User[];
  createdAt: string;
}

// ──────────────────────────────────────
// Dashboard Stats
// ──────────────────────────────────────

export interface DashboardStats {
  newCount: number;
  reviewingCount: number;
  riskCount: number;
  avgResponseTimeHours: number;
}

// ──────────────────────────────────────
// Pendências (Dashboard Sidebar)
// ──────────────────────────────────────

export type PendencyType = "attachment" | "invalid_file" | "inactive" | "risk";

export interface Pendency {
  id: string;
  type: PendencyType;
  icon: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  severity: "info" | "warning" | "error";
}

// ──────────────────────────────────────
// Notifications
// ──────────────────────────────────────

export type NotificationType =
  | "new_submission"
  | "insight_completed"
  | "high_risk"
  | "status_updated"
  | "member_invited"
  | "form_limit_reached";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  meta?: Record<string, any>;
}

// ──────────────────────────────────────
// API Response Wrapper
// ──────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    perPage: number;
  };
}

// ──────────────────────────────────────
// Filter & Sort helpers
// ──────────────────────────────────────

export interface InboxFilters {
  status?: InboxStatus;
  risk?: AIRiskLevel;
  vipOnly?: boolean;
  pendingAttachments?: boolean;
  search?: string;
}

export type InboxSortField = "submittedAt" | "aiRisk" | "attachments" | "clientName";
export type SortDirection = "asc" | "desc";

export interface SortConfig {
  field: InboxSortField;
  direction: SortDirection;
}

// ──────────────────────────────────────
// Invite Links
// ──────────────────────────────────────

export interface InviteLink {
  id: string;
  code: string;
  role: string;
  workspaceId: string;
  createdBy: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  active: boolean;
  createdAt: string;
}

export interface InviteInfo {
  code: string;
  role: string;
  workspaceName: string;
  workspaceLogoUrl?: string;
  workspaceBrandColor?: string;
  expiresAt: string;
}
