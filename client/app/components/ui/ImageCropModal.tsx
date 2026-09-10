"use client";

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ZoomIn, ZoomOut, Check, X } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────

/**
 * Create a cropped image File from an image source and crop area.
 * Outputs a square PNG (or JPEG) at `outputSize × outputSize` pixels.
 */
async function getCroppedFile(
  imageSrc: string,
  cropArea: Area,
  outputSize = 400,
  fileName = "cropped.png",
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, outputSize, outputSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Canvas toBlob failed"));
        resolve(new File([blob], fileName, { type: "image/png" }));
      },
      "image/png",
      1,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── Component ─────────────────────────────────────────────────

interface ImageCropModalProps {
  open: boolean;
  imageSrc: string;
  title?: string;
  /** Output pixel size (default 400) */
  outputSize?: number;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

export default function ImageCropModal({
  open,
  imageSrc,
  title = "Ajustar imagem",
  outputSize = 400,
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedArea) return;
    const file = await getCroppedFile(imageSrc, croppedArea, outputSize);
    onConfirm(file);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 rounded-2xl overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-[14px] font-semibold">{title}</DialogTitle>
        </DialogHeader>

        {/* Crop area */}
        <div className="relative w-full aspect-square bg-zinc-950">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 flex items-center gap-3 border-t border-zinc-100 dark:border-white/[0.05]">
          <ZoomOut size={14} className="text-zinc-400 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-1.5 accent-primary cursor-pointer"
          />
          <ZoomIn size={14} className="text-zinc-400 shrink-0" />
        </div>

        {/* Actions */}
        <div className="px-5 py-3 flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-white/[0.05]">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
          >
            <X size={12} />
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-85 transition-opacity"
          >
            <Check size={12} />
            Confirmar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
