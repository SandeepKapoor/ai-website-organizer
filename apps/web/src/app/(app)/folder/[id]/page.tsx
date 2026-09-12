import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Library } from "@/components/Library";

async function getBreadcrumbChain(folderId: string) {
  const chain: { id: string; name: string }[] = [];
  let current = await prisma.bookmarkFolder.findUnique({ where: { id: folderId } });
  if (!current) return null;

  while (current) {
    chain.unshift({ id: current.id, name: current.name });
    current = current.parentFolderId
      ? await prisma.bookmarkFolder.findUnique({ where: { id: current.parentFolderId } })
      : null;
  }
  return chain;
}

export default async function FolderPage({ params }: { params: { id: string } }) {
  const chain = await getBreadcrumbChain(params.id);
  if (!chain) notFound();

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-neutral-400">
      <Link href="/" className="hover:text-neutral-900 dark:hover:text-white">
        All Bookmarks
      </Link>
      {chain.map((f) => (
        <span key={f.id} className="flex items-center gap-1">
          <span>/</span>
          <Link href={`/folder/${f.id}`} className="hover:text-neutral-900 dark:hover:text-white">
            {f.name}
          </Link>
        </span>
      ))}
    </nav>
  );

  const currentName = chain[chain.length - 1].name;

  return <Library folderId={params.id} title={currentName} breadcrumb={breadcrumb} />;
}
