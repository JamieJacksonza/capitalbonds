import { Suspense } from "react";
import DealViewClient from "./DealViewClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dealKey = decodeURIComponent(String(id || "")).trim();

  return (
    <Suspense fallback={null}>
      <DealViewClient dealKey={dealKey} />
    </Suspense>
  );
}
