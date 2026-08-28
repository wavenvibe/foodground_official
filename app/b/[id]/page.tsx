import { redirect } from "next/navigation";

export default async function LegacyFacilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/facilities/${encodeURIComponent(id)}`);
}
