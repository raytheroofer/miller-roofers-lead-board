import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4">
      <p className="text-xs uppercase tracking-[0.2em] text-copper">Mrs Roofers</p>
      <h1 className="mt-2 font-serif text-3xl">That page is not in the tracker</h1>
      <Link href="/" className="mt-4 text-sm text-muted hover:text-ink">
        Back to the board
      </Link>
    </div>
  );
}
