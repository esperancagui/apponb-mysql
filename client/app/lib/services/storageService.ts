/**
 * Storage Service — upload/delete helpers backed by the API's MinIO-backed
 * upload endpoints (`POST /api/uploads/*`), replacing the old direct-to-
 * Firebase-Storage uploads. Same exported function names/signatures as
 * before so callers (BrandingEditor, settings, profile, FormRenderer) don't
 * change.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Compress an image file using a canvas element.
 * Returns a Blob ready for upload.
 * @param format - "image/png" preserves transparency; "image/jpeg" applies quality compression.
 */
function compressImageToBlob(
  file: File,
  maxWidth: number,
  format: "image/png" | "image/jpeg" = "image/png"
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Falha ao processar a imagem."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D não suportado."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Falha na compressão da imagem."));
          },
          format,
          0.9
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const { auth } = await import("../authClient");
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function uploadForm(url: string, form: FormData, authed: boolean): Promise<string> {
  const headers = authed ? await authHeaders() : {};
  const res = await fetch(url, { method: "POST", body: form, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Falha no upload.");
  }
  const data = await res.json();
  return data.url as string;
}

/**
 * Upload a branding image (logo or hero).
 *
 * 1. Compresses the image client-side
 * 2. Uploads via POST /api/uploads/branding
 * 3. Returns the public URL
 *
 * @param file       - The raw File from the input element
 * @param type       - "logo" or "hero"
 * @param workspaceId - Current workspace ID (required)
 * @param maxWidth   - Max pixel width for compression (default: 400 for logo, 1200 for hero)
 */
export async function uploadBrandingImage(
  file: File,
  type: "logo" | "hero",
  workspaceId?: string,
  maxWidth?: number
): Promise<string> {
  if (!workspaceId) {
    throw new Error("workspaceId é obrigatório para upload de branding.");
  }
  const defaultMaxWidth = type === "logo" ? 400 : 1200;
  // Hero uses JPEG for real quality compression; logo uses PNG to preserve transparency
  const format = type === "hero" ? "image/jpeg" : "image/png";
  const blob = await compressImageToBlob(file, maxWidth ?? defaultMaxWidth, format);

  const form = new FormData();
  form.append("file", blob, file.name);
  form.append("kind", type);
  form.append("workspace_id", workspaceId);
  return uploadForm(`${API_URL}/api/uploads/branding`, form, true);
}

/**
 * Upload a user avatar. Returns the public URL.
 */
export async function uploadAvatarImage(file: File, _uid: string): Promise<string> {
  const blob = await compressImageToBlob(file, 400, "image/jpeg");
  const form = new FormData();
  form.append("file", blob, file.name);
  return uploadForm(`${API_URL}/api/uploads/avatar`, form, true);
}

/**
 * Whether a URL points at a file we uploaded (MinIO, via our own API) rather
 * than some unrelated external link. Replaces the old
 * `startsWith("https://firebasestorage")` host sniff.
 */
export function isUploadUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.startsWith(API_URL) || url.includes("/onb/");
}

/**
 * Delete a previously-uploaded image by its URL.
 * Silently ignores errors (e.g. file already deleted, invalid URL).
 */
export async function deleteStorageImage(url: string): Promise<void> {
  try {
    if (!isUploadUrl(url)) return;
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/uploads?url=${encodeURIComponent(url)}`, {
      method: "DELETE",
      headers,
    });
  } catch {
    // Silently ignore — file may already be deleted or URL may be invalid
  }
}

/**
 * Upload a submission file.
 *
 * Used by the public form renderer — does NOT require authentication.
 * Files are stored as-is (no compression) to preserve originals.
 *
 * @param file    - The raw File from the input element
 * @param formId  - The form ID this submission belongs to
 * @param fieldId - The field ID this file was uploaded to
 * @returns The public URL
 */
export async function uploadSubmissionFile(
  file: File,
  formId: string,
  fieldId: string
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("form_id", formId);
  form.append("field_id", fieldId);
  return uploadForm(`${API_URL}/api/uploads/submission`, form, false);
}
