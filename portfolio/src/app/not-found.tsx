import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[100svh] place-items-center px-5">
      <div className="max-w-xl text-center">
        <p className="label">Error 404</p>
        <h1 className="display mt-6 text-[clamp(3rem,10vw,7rem)]">
          No signal <em className="font-display italic text-accent">here.</em>
        </h1>
        <p className="mt-6 text-muted">This page doesn&apos;t exist, or it hasn&apos;t been published yet.</p>
        <Link href="/" className="btn btn-primary mt-10">
          Back to the homepage
        </Link>
      </div>
    </main>
  );
}
