import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";
import { getAdminGalleryData } from "@/server/services/gallery.service";
import { GalleryManager } from "@/components/admin/GalleryManager";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const canManage =
    session.roles.includes("super_admin") || hasPermission(session, "content.manage");

  const data = await getAdminGalleryData();

  return (
    <GalleryManager
      categories={data.categories}
      items={data.items}
      articles={data.articles}
      canManage={canManage}
    />
  );
}
