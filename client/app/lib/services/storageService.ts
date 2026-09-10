/**
 * Storage Service — Firebase Storage upload/delete helpers.
 *
 * Uploads images directly from the client to Firebase Storage
 * and returns public download URLs.
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../firebase";

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

/**
 * Build a storage path for branding images.
 *
 * Pattern: workspaces/{workspaceId}/branding/{type}/{timestamp}_{filename}
 */
function buildBrandingPath(
  workspaceId: string | undefined,
  type: "logo" | "hero",
  fileName: string
): string {
  if (!workspaceId) {
    throw new Error("workspaceId é obrigatório para upload de branding.");
  }
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  return `workspaces/${workspaceId}/branding/${type}/${timestamp}_${safeName}`;
}

/**
 * Upload a branding image (logo or hero) to Firebase Storage.
 *
 * 1. Compresses the image client-side
 * 2. Uploads to Firebase Storage
 * 3. Returns the public download URL
 *
 * @param file       - The raw File from the input element
 * @param type       - "logo" or "hero"
 * @param workspaceId - Current workspace ID (optional)
 * @param maxWidth   - Max pixel width for compression (default: 400 for logo, 1200 for hero)
 */
export async function uploadBrandingImage(
  file: File,
  type: "logo" | "hero",
  workspaceId?: string,
  maxWidth?: number
): Promise<string> {
  const defaultMaxWidth = type === "logo" ? 400 : 1200;
  // Hero uses JPEG for real quality compression; logo uses PNG to preserve transparency
  const format = type === "hero" ? "image/jpeg" : "image/png";
  const blob = await compressImageToBlob(file, maxWidth ?? defaultMaxWidth, format);

  const path = buildBrandingPath(workspaceId, type, file.name);
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, blob, {
    contentType: format,
    cacheControl: "public, max-age=31536000", // 1 year cache
  });

  return getDownloadURL(storageRef);
}

/**
 * Upload a user avatar to Firebase Storage.
 * Path: avatars/{uid}/{timestamp}_{filename}
 * Returns the public download URL.
 */
export async function uploadAvatarImage(file: File, uid: string): Promise<string> {
  const blob = await compressImageToBlob(file, 400, "image/jpeg");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `avatars/${uid}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    contentType: "image/jpeg",
    cacheControl: "public, max-age=31536000",
  });
  return getDownloadURL(storageRef);
}

/**
 * Delete an image from Firebase Storage by its download URL.
 * Silently ignores errors (e.g. file already deleted, invalid URL).
 */
export async function deleteStorageImage(url: string): Promise<void> {
  try {
    // Only attempt delete for Firebase Storage URLs
    if (!url.includes("firebasestorage.googleapis.com") && !url.includes("storage.googleapis.com")) {
      return;
    }
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch {
    // Silently ignore — file may already be deleted or URL may be invalid
  }
}

/**
 * Upload a submission file to Firebase Storage.
 *
 * Used by the public form renderer — does NOT require authentication.
 * Files are stored as-is (no compression) to preserve originals.
 *
 * Path: submissions/{formId}/{fieldId}/{timestamp}_{filename}
 *
 * @param file    - The raw File from the input element
 * @param formId  - The form ID this submission belongs to
 * @param fieldId - The field ID this file was uploaded to
 * @returns The public download URL
 */
export async function uploadSubmissionFile(
  file: File,
  formId: string,
  fieldId: string
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const path = `submissions/${formId}/${fieldId}/${timestamp}_${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "public, max-age=31536000",
  });

  return getDownloadURL(storageRef);
}

