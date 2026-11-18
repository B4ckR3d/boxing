"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";

async function assertCanManage() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const can = session.roles.includes("super_admin") || hasPermission(session, "content.manage");
  if (!can) throw new Error("Forbidden: requires content.manage");
  return session;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// -----------------------------------------------------------------------------
// CATEGORIES
// -----------------------------------------------------------------------------

export async function createCategoryAction(formData: FormData) {
  await assertCanManage();

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const sortOrder = parseInt(String(formData.get("sortOrder") || "0"), 10) || 0;

  if (!name) throw new Error("Nama kategori wajib diisi");

  let slug = slugify(name);
  if (!slug) slug = `cat-${Date.now()}`;

  // Cek duplikasi slug
  const existing = await prisma.galleryCategory.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }

  await prisma.galleryCategory.create({
    data: {
      name,
      slug,
      description,
      sortOrder,
      isActive: true,
    },
  });

  revalidatePath("/admin/gallery");
  revalidatePath("/news");
  return { success: true };
}

export async function deleteCategoryAction(id: string) {
  await assertCanManage();
  await prisma.galleryCategory.delete({ where: { id } });
  revalidatePath("/admin/gallery");
  revalidatePath("/news");
  return { success: true };
}

// -----------------------------------------------------------------------------
// GALLERY ITEMS
// -----------------------------------------------------------------------------

export async function createGalleryItemAction(formData: FormData) {
  await assertCanManage();

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const categoryId = String(formData.get("categoryId") || "").trim();
  const sortOrder = parseInt(String(formData.get("sortOrder") || "0"), 10) || 0;

  if (!title) throw new Error("Judul foto wajib diisi");
  if (!imageUrl) throw new Error("URL gambar foto wajib diisi");
  if (!categoryId) throw new Error("Pilih kategori foto");

  await prisma.galleryItem.create({
    data: {
      title,
      description,
      imageUrl,
      categoryId,
      sortOrder,
      isActive: true,
    },
  });

  revalidatePath("/admin/gallery");
  revalidatePath("/news");
  return { success: true };
}

export async function deleteGalleryItemAction(id: string) {
  await assertCanManage();
  await prisma.galleryItem.delete({ where: { id } });
  revalidatePath("/admin/gallery");
  revalidatePath("/news");
  return { success: true };
}

// -----------------------------------------------------------------------------
// ARTICLES
// -----------------------------------------------------------------------------

export async function createArticleAction(formData: FormData) {
  await assertCanManage();

  const title = String(formData.get("title") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const coverUrl = String(formData.get("coverUrl") || "").trim() || null;
  const category = String(formData.get("category") || "Berita").trim();
  const authorName = String(formData.get("authorName") || "Redaksi TFN").trim();

  if (!title || !content) throw new Error("Judul dan konten berita wajib diisi");

  let slug = slugify(title);
  if (!slug) slug = `news-${Date.now()}`;
  const existing = await prisma.article.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  await prisma.article.create({
    data: {
      title,
      slug,
      excerpt: excerpt || title,
      content,
      coverUrl,
      category,
      authorName,
      isPublished: true,
    },
  });

  revalidatePath("/admin/gallery");
  revalidatePath("/news");
  return { success: true };
}

export async function deleteArticleAction(id: string) {
  await assertCanManage();
  await prisma.article.delete({ where: { id } });
  revalidatePath("/admin/gallery");
  revalidatePath("/news");
  return { success: true };
}
