import { redirect } from "next/navigation";

export default async function IngredientDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect("/substitutes");
}
