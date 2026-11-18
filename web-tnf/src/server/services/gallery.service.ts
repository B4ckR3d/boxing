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

const DEFAULT_CATEGORIES: GalleryCategoryData[] = [
  { id: "cat-vol-1", name: "TFN Volume 1", slug: "volume-1", description: "Dokumentasi laga perdana TFN", sortOrder: 1, isActive: true, itemCount: 1 },
  { id: "cat-vol-2", name: "TFN Volume 2", slug: "volume-2", description: "Dokumentasi laga TFN Vol. 2", sortOrder: 2, isActive: true, itemCount: 1 },
  { id: "cat-vol-3", name: "TFN Volume 3", slug: "volume-3", description: "Dokumentasi laga TFN Vol. 3", sortOrder: 3, isActive: true, itemCount: 1 },
  { id: "cat-vol-4", name: "TFN Volume 4", slug: "volume-4", description: "Dokumentasi laga TFN Vol. 4", sortOrder: 4, isActive: true, itemCount: 1 },
  { id: "cat-vol-5", name: "TFN Volume 5", slug: "volume-5", description: "Dokumentasi laga TFN Vol. 5", sortOrder: 5, isActive: true, itemCount: 1 },
  { id: "cat-weighin", name: "Timbang Badan & Seremonial", slug: "weigh-in", description: "Sesi timbang badan petarung", sortOrder: 6, isActive: true, itemCount: 1 },
];

const DEFAULT_ITEMS: GalleryItemData[] = [
  {
    id: "item-def-1",
    title: "Momen KO Spektakuler Ronde 4",
    description: "Pertarungan sengit di atas ring Temanggung Fight Night Volume 1",
    imageUrl: "/images/hero/boxing-ring-arena.jpg",
    categoryId: "cat-vol-1",
    categoryName: "TFN Volume 1",
    categorySlug: "volume-1",
    sortOrder: 1,
    isActive: true,
    takenAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "item-def-2",
    title: "Perebutan Sabuk Juara Kelas Berat",
    description: "Duel sengit perebutan mahkota kelas berat di TFN Volume 2",
    imageUrl: "/images/hero/boxing-ring-arena.jpg",
    categoryId: "cat-vol-2",
    categoryName: "TFN Volume 2",
    categorySlug: "volume-2",
    sortOrder: 2,
    isActive: true,
    takenAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "item-def-3",
    title: "Sorak Penonton GOR Bambu Runcing",
    description: "Atmosfer gemuruh ribuan penonton setia di TFN Volume 3",
    imageUrl: "/images/hero/boxing-ring-arena.jpg",
    categoryId: "cat-vol-3",
    categoryName: "TFN Volume 3",
    categorySlug: "volume-3",
    sortOrder: 3,
    isActive: true,
    takenAt: null,
    createdAt: new Date().toISOString(),
  },
];

/** Mengambil seluruh data publik galeri dan berita */
export async function getPublicGalleryData() {
  try {
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

    const mappedCategories =
      categories.length > 0
        ? categories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description,
            sortOrder: c.sortOrder,
            isActive: c.isActive,
            itemCount: c._count.items,
          }))
        : DEFAULT_CATEGORIES;

    const mappedItems =
      items.length > 0
        ? items.map((i) => ({
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
          }))
        : DEFAULT_ITEMS;

    return {
      categories: mappedCategories,
      items: mappedItems,
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
  } catch (error) {
    console.error("getPublicGalleryData database fallback error:", error);
    return {
      categories: DEFAULT_CATEGORIES,
      items: DEFAULT_ITEMS,
      articles: [],
    };
  }
}

/** Mengambil data galeri lengkap untuk panel admin CMS */
export async function getAdminGalleryData() {
  try {
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
  } catch (error) {
    console.error("getAdminGalleryData database fallback error:", error);
    return {
      categories: DEFAULT_CATEGORIES,
      items: DEFAULT_ITEMS,
      articles: [],
    };
  }
}
