import type { Metadata } from "next";
import PublicFormClient from "./PublicFormClient";
import { getFormMeta } from "@/app/lib/serverFormStore";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = getFormMeta(slug);

  const title = meta?.seoTitle || meta?.name || "Formulário | onb.";
  const description = meta?.seoDescription || "Preencha o formulário.";
  const thumbnailUrl = meta?.seoThumbnailUrl;

  return {
    title,
    description,
    ...(meta?.faviconUrl ? { icons: { icon: meta.faviconUrl } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      url: `/f/${slug}`,
      ...(thumbnailUrl ? { images: [{ url: thumbnailUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: thumbnailUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(thumbnailUrl ? { images: [thumbnailUrl] } : {}),
    },
  };
}

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicFormClient slug={slug} />;
}
