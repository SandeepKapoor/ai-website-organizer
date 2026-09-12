"use client";

const OPTIONS = [
  { value: "folder_order", label: "Original order" },
  { value: "recently_added", label: "Recently added" },
  { value: "recently_updated", label: "Recently updated" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "folder", label: "Folder" },
];

export function SortSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 outline-none dark:border-neutral-700 dark:bg-ink-900 dark:text-neutral-300"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
