"use client";

import React, { useState, useTransition } from "react";
import { Plus, Trash2, Image, Layers, Newspaper, ExternalLink, Calendar, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  createCategoryAction,
  deleteCategoryAction,
  createGalleryItemAction,
  deleteGalleryItemAction,
  createArticleAction,
  deleteArticleAction,
} from "@/app/admin/(dashboard)/gallery/actions";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  itemCount?: number;
}

interface GalleryItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  categoryId: string;
  categoryName?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  coverUrl: string | null;
  publishedAt: string;
  authorName: string;
}

export function GalleryManager({
  categories,
  items,
  articles,
  canManage,
}: {
  categories: Category[];
  items: GalleryItem[];
  articles: Article[];
  canManage: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"photos" | "categories" | "articles">("photos");
  const [isPending, startTransition] = useTransition();

  // Form toggles
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddArticle, setShowAddArticle] = useState(false);

  // Filter category in photo list
  const [filterCat, setFilterCat] = useState<string>("all");

  const filteredItems = filterCat === "all" ? items : items.filter((i) => i.categoryId === filterCat);

  const inputClass =
    "w-full bg-canvas border border-subtle focus:border-fight-red focus-visible:outline-2 focus-visible:outline-fight-red px-3.5 py-2.5 text-ink font-mono-data text-xs disabled:opacity-60";
  const labelClass = "block font-mono-data text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1";

  // Handlers
  const handleAddCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createCategoryAction(formData);
        toast.success("Kategori galeri berhasil ditambahkan");
        setShowAddCat(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menambah kategori");
      }
    });
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (!confirm(`Hapus kategori "${name}" beserta semua foto di dalamnya?`)) return;
    startTransition(async () => {
      try {
        await deleteCategoryAction(id);
        toast.success("Kategori berhasil dihapus");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus kategori");
      }
    });
  };

  const handleAddPhoto = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createGalleryItemAction(formData);
        toast.success("Foto berhasil ditambahkan ke galeri");
        setShowAddPhoto(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menambah foto");
      }
    });
  };

  const handleDeletePhoto = (id: string, title: string) => {
    if (!confirm(`Hapus foto "${title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteGalleryItemAction(id);
        toast.success("Foto berhasil dihapus");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus foto");
      }
    });
  };

  const handleAddArticle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createArticleAction(formData);
        toast.success("Artikel berita berhasil diterbitkan");
        setShowAddArticle(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menerbitkan artikel");
      }
    });
  };

  const handleDeleteArticle = (id: string, title: string) => {
    if (!confirm(`Hapus artikel "${title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteArticleAction(id);
        toast.success("Artikel berita berhasil dihapus");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus artikel");
      }
    });
  };

  return (
    <div className="space-y-6 text-ink select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-5">
        <div>
          <h1 className="font-display text-3xl uppercase font-black tracking-tight">
            Manajemen Berita & Galeri
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Kelola foto dokumentasi pertarungan (Volume 1 - 5, dll.), kategori album, dan artikel publikasi resmi TFN.
          </p>
        </div>

        <a
          href="/news"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-subtle bg-charcoal hover:border-fight-red font-mono-data text-xs font-bold text-ink transition-colors"
        >
          <span>Lihat Halaman Publik</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-subtle">
        <button
          type="button"
          onClick={() => setActiveTab("photos")}
          className={`flex items-center gap-2 px-5 py-3 font-mono-data text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "photos"
              ? "border-fight-red text-fight-red bg-fight-red/5"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Image className="w-4 h-4" />
          <span>Foto Galeri ({items.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-5 py-3 font-mono-data text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "categories"
              ? "border-fight-red text-fight-red bg-fight-red/5"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Kategori / Volume ({categories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("articles")}
          className={`flex items-center gap-2 px-5 py-3 font-mono-data text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "articles"
              ? "border-fight-red text-fight-red bg-fight-red/5"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Newspaper className="w-4 h-4" />
          <span>Artikel Berita ({articles.length})</span>
        </button>
      </div>

      {/* TAB 1: FOTO GALERI */}
      {activeTab === "photos" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Filter Category */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono-data text-xs text-ink-muted">Filter Volume:</span>
              <button
                type="button"
                onClick={() => setFilterCat("all")}
                className={`px-3 py-1 font-mono-data text-xs border ${
                  filterCat === "all" ? "bg-fight-red text-white border-fight-red" : "border-subtle hover:border-ink"
                }`}
              >
                Semua ({items.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilterCat(c.id)}
                  className={`px-3 py-1 font-mono-data text-xs border ${
                    filterCat === c.id ? "bg-fight-red text-white border-fight-red" : "border-subtle hover:border-ink"
                  }`}
                >
                  {c.name} ({c.itemCount || 0})
                </button>
              ))}
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => setShowAddPhoto(!showAddPhoto)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-fight-red hover:bg-fight-red-hover text-white font-mono-data text-xs font-bold uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Foto Galeri</span>
              </button>
            )}
          </div>

          {/* Form Tambah Foto */}
          {showAddPhoto && (
            <form onSubmit={handleAddPhoto} className="p-5 border border-fight-red bg-charcoal space-y-4 shadow-lg">
              <h3 className="font-display text-lg uppercase font-bold text-fight-red flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>Form Unggah Foto Galeri Baru</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Judul / Momen Foto *</label>
                  <input name="title" required placeholder="Contoh: Partai Final Kelas Berat Ronde 3" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Kategori / Volume *</label>
                  <select name="categoryId" required className={inputClass}>
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>URL Gambar Foto *</label>
                  <input
                    name="imageUrl"
                    required
                    placeholder="Contoh: /images/hero/boxing-ring-arena.jpg atau link URL publik"
                    className={inputClass}
                  />
                  <p className="font-mono-data text-[10px] text-ink-muted mt-1">
                    Anda bisa memasukkan path gambar internal (seperti <code>/images/hero/boxing-ring-arena.jpg</code>) atau URL file gambar eksternal.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Keterangan / Deskripsi Singkat</label>
                  <textarea name="description" rows={2} placeholder="Penjelasan momen pertandingan..." className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Urutan Tampil (Sort Order)</label>
                  <input name="sortOrder" type="number" defaultValue="0" className={inputClass} />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-fight-red text-white font-mono-data text-xs font-bold uppercase tracking-wider hover:bg-fight-red-hover disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan Foto"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPhoto(false)}
                  className="px-4 py-2 border border-subtle font-mono-data text-xs hover:border-ink"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Grid Foto */}
          {filteredItems.length === 0 ? (
            <div className="p-12 border border-subtle bg-charcoal text-center space-y-2">
              <Image className="w-10 h-10 text-ink-muted mx-auto opacity-50" />
              <p className="font-mono-data text-sm font-bold text-ink-muted">Belum ada foto pada kategori ini.</p>
              <p className="font-mono-data text-xs text-ink-muted">Klik "Tambah Foto Galeri" untuk mengunggah momen baru.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredItems.map((item) => (
                <div key={item.id} className="border border-subtle bg-charcoal group overflow-hidden flex flex-col justify-between">
                  <div className="relative aspect-[4/3] bg-black overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2 bg-fight-red text-white font-mono-data text-[10px] font-bold px-2 py-0.5 shadow">
                      {item.categoryName || "Galeri"}
                    </div>
                  </div>
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-display text-sm font-bold uppercase text-ink line-clamp-1">{item.title}</h4>
                      {item.description && <p className="text-xs text-ink-muted line-clamp-2 mt-1">{item.description}</p>}
                    </div>

                    {canManage && (
                      <div className="pt-2 border-t border-subtle flex items-center justify-between">
                        <span className="font-mono-data text-[10px] text-ink-muted">Urutan: {item.sortOrder}</span>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(item.id, item.title)}
                          disabled={isPending}
                          className="text-ink-muted hover:text-fight-red p-1 transition-colors"
                          title="Hapus foto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: KATEGORI / VOLUME */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="font-mono-data text-xs text-ink-muted">
              Daftar volume dan album kategori foto pertarungan resmi TFN.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowAddCat(!showAddCat)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-fight-red hover:bg-fight-red-hover text-white font-mono-data text-xs font-bold uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kategori Baru</span>
              </button>
            )}
          </div>

          {/* Form Tambah Kategori */}
          {showAddCat && (
            <form onSubmit={handleAddCategory} className="p-5 border border-fight-red bg-charcoal space-y-4 shadow-lg">
              <h3 className="font-display text-lg uppercase font-bold text-fight-red flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>Tambah Kategori / Volume Album Baru</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nama Kategori *</label>
                  <input name="name" required placeholder="Contoh: TFN Volume 6" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Urutan Tampil (Sort Order)</label>
                  <input name="sortOrder" type="number" defaultValue="0" className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Keterangan Kategori</label>
                  <input name="description" placeholder="Deskripsi ringkas volume/kegiatan..." className={inputClass} />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-fight-red text-white font-mono-data text-xs font-bold uppercase tracking-wider hover:bg-fight-red-hover disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan Kategori"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCat(false)}
                  className="px-4 py-2 border border-subtle font-mono-data text-xs hover:border-ink"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Tabel Kategori */}
          <div className="border border-subtle overflow-x-auto bg-charcoal">
            <table className="w-full text-left font-mono-data text-xs">
              <thead className="bg-canvas border-b border-subtle text-ink-muted uppercase">
                <tr>
                  <th className="p-3.5">Urutan</th>
                  <th className="p-3.5">Nama Kategori</th>
                  <th className="p-3.5">Slug URL</th>
                  <th className="p-3.5">Jumlah Foto</th>
                  <th className="p-3.5">Deskripsi</th>
                  {canManage && <th className="p-3.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-canvas/50">
                    <td className="p-3.5 font-bold text-fight-red">{cat.sortOrder}</td>
                    <td className="p-3.5 font-bold text-ink">{cat.name}</td>
                    <td className="p-3.5 text-ink-muted"><code>{cat.slug}</code></td>
                    <td className="p-3.5 text-ink">{cat.itemCount || 0} foto</td>
                    <td className="p-3.5 text-ink-muted max-w-xs truncate">{cat.description || "—"}</td>
                    {canManage && (
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          disabled={isPending}
                          className="text-ink-muted hover:text-fight-red p-1 transition-colors"
                          title="Hapus kategori"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ARTIKEL BERITA */}
      {activeTab === "articles" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="font-mono-data text-xs text-ink-muted">
              Publikasi rilis pers, berita resmi, dan artikel redaksi TFN.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowAddArticle(!showAddArticle)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-fight-red hover:bg-fight-red-hover text-white font-mono-data text-xs font-bold uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                <span>Tulis Berita Baru</span>
              </button>
            )}
          </div>

          {/* Form Tambah Artikel */}
          {showAddArticle && (
            <form onSubmit={handleAddArticle} className="p-5 border border-fight-red bg-charcoal space-y-4 shadow-lg">
              <h3 className="font-display text-lg uppercase font-bold text-fight-red flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>Form Tulis Berita / Artikel Baru</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Judul Berita *</label>
                  <input name="title" required placeholder="Judul artikel pengumuman resmi..." className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Kategori Berita</label>
                  <input name="category" defaultValue="Berita" placeholder="Contoh: Turnamen, Press Release, Analisis" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Nama Penulis / Redaksi</label>
                  <input name="authorName" defaultValue="Redaksi TFN" className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>URL Gambar Cover</label>
                  <input name="coverUrl" defaultValue="/images/hero/boxing-ring-arena.jpg" className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Ringkasan (Excerpt) *</label>
                  <input name="excerpt" required placeholder="Ringkasan 1-2 kalimat untuk kartu berita..." className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Konten Berita Lengkap *</label>
                  <textarea name="content" required rows={6} placeholder="Isi berita lengkap..." className={inputClass} />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-fight-red text-white font-mono-data text-xs font-bold uppercase tracking-wider hover:bg-fight-red-hover disabled:opacity-50"
                >
                  {isPending ? "Menerbitkan..." : "Terbitkan Berita"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddArticle(false)}
                  className="px-4 py-2 border border-subtle font-mono-data text-xs hover:border-ink"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Daftar Artikel */}
          {articles.length === 0 ? (
            <div className="p-12 border border-subtle bg-charcoal text-center space-y-2">
              <Newspaper className="w-10 h-10 text-ink-muted mx-auto opacity-50" />
              <p className="font-mono-data text-sm font-bold text-ink-muted">Belum ada artikel berita yang diterbitkan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((art) => (
                <div key={art.id} className="p-5 border border-subtle bg-charcoal flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 font-mono-data text-xs">
                      <span className="bg-fight-red text-white px-2 py-0.5 text-[10px] font-bold uppercase">
                        {art.category}
                      </span>
                      <span className="text-ink-muted">Oleh {art.authorName}</span>
                      <span className="text-ink-muted">·</span>
                      <span className="text-ink-muted">{new Date(art.publishedAt).toLocaleDateString("id-ID")}</span>
                    </div>
                    <h3 className="font-display text-xl font-bold uppercase text-ink">{art.title}</h3>
                    <p className="text-xs text-ink-muted line-clamp-2">{art.excerpt}</p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDeleteArticle(art.id, art.title)}
                      disabled={isPending}
                      className="p-2 border border-subtle hover:border-fight-red text-ink-muted hover:text-fight-red transition-colors shrink-0"
                      title="Hapus artikel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
