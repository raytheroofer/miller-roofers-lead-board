import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-paper px-4">
      <BrandMark className="h-16 w-16" />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">Mrs Roofers</p>
      <h1 className="mt-2 font-serif text-3xl">That page is not in the tracker</h1>
      <Link href="/" className="mt-4 text-sm text-muted hover:text-ink">
        Back to the board
      </Link>
    </div>
  );
}
