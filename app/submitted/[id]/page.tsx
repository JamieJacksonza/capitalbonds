import { redirect } from "next/navigation";

export default async function SubmissionDetailPage({ params }: { params: any }) {
  // Your older route /submitted/[id] will now redirect to /deal/[id]
  const p = await params;
  const id = decodeURIComponent(String(p?.id || ""));
  redirect(`/deal/${encodeURIComponent(id)}`);
}
