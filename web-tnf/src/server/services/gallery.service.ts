import "server-only";
import { prisma } from "@/lib/db/prisma";

export interface GalleryCategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  itemCount?: number;
}

export interface GalleryItemData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  categoryId: string;
  categoryName?: string;
  categorySlug?: string;
  sortOrder: number;
  isActive: boolean;
  takenAt: string | null;
  createdAt: string;
}

export interface ArticleData {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl: string | null;
  category: string;
  isPublished: boolean;
  publishedAt: string;
  authorName: string;
}

/** Mengambil seluruh data publik galeri dan berita */
export async function getPublicGalleryData() {
  const [categories, items, articles] = await Promise.all([
    prisma.galleryCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { items: { where: { isActive: true } } } },
      },
    }),
    prisma.galleryItem.findMany({
      where: { isActive: true, category: { isActive: true } },
      include: { category: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.article.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      itemCount: c._count.items,
    })),
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      imageUrl: i.imageUrl,
      categoryId: i.categoryId,
      categoryName: i.category.name,
      categorySlug: i.category.slug,
      sortOrder: i.sortOrder,
      isActive: i.isActive,
      takenAt: i.takenAt ? i.takenAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
    })),
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      content: a.content,
      coverUrl: a.coverUrl,
      category: a.category,
      isPublished: a.isPublished,
      publishedAt: a.publishedAt.toISOString(),
      authorName: a.authorName,
    })),
  };
}

/** Mengambil data galeri lengkap untuk panel admin CMS */
export async function getAdminGalleryData() {
  const [categories, items, articles] = await Promise.all([
    prisma.galleryCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { items: true } },
      },
    }),
    prisma.galleryItem.findMany({
      include: { category: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.article.findMany({
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      itemCount: c._count.items,
    })),
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      imageUrl: i.imageUrl,
      categoryId: i.categoryId,
      categoryName: i.category.name,
      categorySlug: i.category.slug,
      sortOrder: i.sortOrder,
      isActive: i.isActive,
      takenAt: i.takenAt ? i.takenAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
    })),
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      content: a.content,
      coverUrl: a.coverUrl,
      category: a.category,
      isPublished: a.isPublished,
      publishedAt: a.publishedAt.toISOString(),
      authorName: a.authorName,
    })),
  };
}
