"use client";

export type ViewMode = "grid" | "masonry" | "list";

const OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "masonry", label: "Masonry" },
  { value: "list", label: "List" },
];

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-neutral-200 p-0.5 text-xs dark:border-neutral-700">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1.5 transition ${
            value === opt.value
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
