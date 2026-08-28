import { redirect } from "next/navigation";

export default async function LegacySearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams;
  const output = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") output.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => output.append(key, item));
  }
  const query = output.toString();
  redirect(`/facilities${query ? `?${query}` : ""}`);
}
