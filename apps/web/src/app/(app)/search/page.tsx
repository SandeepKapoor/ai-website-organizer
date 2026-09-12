import { Library } from "@/components/Library";

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? "";
  return <Library query={q} title={q ? `Results for "${q}"` : "Search"} />;
}
