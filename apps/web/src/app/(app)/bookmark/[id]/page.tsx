import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeBookmark } from "@/lib/serialize";
import { ThumbnailPlaceholder } from "@/components/ThumbnailPlaceholder";

export default async function BookmarkDetailPage({ params }: { params: { id: string } }) {
  const record = await prisma.bookmark.findUnique({
    where: { id: params.id },
    include: { website: true, folder: true },
  });
  if (!record || record.isDeleted) notFound();

  const bookmark = serializeBookmark(record);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900">
        {bookmark.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bookmark.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <ThumbnailPlaceholder domain={bookmark.domain} title={bookmark.title} />
        )}
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{bookmark.title}</h1>
        <p className="text-sm text-neutral-500">{bookmark.domain}</p>
      </div>

      {bookmark.description ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Description
          </p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{bookmark.description}</p>
        </div>
      ) : (
        <p className="text-sm text-neutral-400">Website metadata unavailable.</p>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Chrome folder
          </p>
          <p className="text-sm">{bookmark.folderPath || "—"}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Added
          </p>
          <p className="text-sm">
            {new Date(bookmark.dateAdded).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="w-fit rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        Open Website
      </a>
    </div>
  );
}
