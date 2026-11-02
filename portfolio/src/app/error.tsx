"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="grid min-h-[100svh] place-items-center px-5">
      <div className="max-w-xl text-center">
        <p className="label">Something went wrong</p>
        <h1 className="display mt-6 text-[clamp(2.6rem,8vw,5.5rem)]">A temporary glitch.</h1>
        <p className="mt-6 text-muted">The page couldn&apos;t load. This is usually a brief database hiccup. Please try again.</p>
        <button type="button" onClick={reset} className="btn btn-primary mt-10">
          Try again
        </button>
      </div>
    </main>
  );
}
