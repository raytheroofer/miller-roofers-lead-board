"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl space-y-4 p-8">
    <h1 className="font-serif text-2xl">This request could not be completed</h1>
    <p>Check the current record before trying again; a save may have completed before the response failed.</p>
    <button className="rounded-md border px-3 py-2" onClick={() => reset()}>Reload this view</button>
    <p><Link className="underline" href="/today">Return to Today</Link></p>
  </main>;
}
