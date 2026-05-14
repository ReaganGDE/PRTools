export function ComingSoon({
  phase,
  description,
}: {
  phase: string;
  description: string;
}) {
  return (
    <div className="p-8">
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <div className="mb-2 inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {phase}
        </div>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
    </div>
  );
}
