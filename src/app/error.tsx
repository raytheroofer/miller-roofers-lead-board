"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4">
      <h1 className="font-serif text-3xl">Something broke in the tracker</h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-navy px-3 py-2 text-sm text-white"
      >
        Try again
      </button>
    </div>
  );
}
