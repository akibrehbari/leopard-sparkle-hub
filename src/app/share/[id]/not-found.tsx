import Link from "next/link";

export default function ShareNotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div className="max-w-md">
        <div className="text-5xl mb-3">404</div>
        <h1 className="text-xl font-semibold mb-2">
          This share link is no longer valid
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          The influencer this link points to either doesn&rsquo;t exist or has
          been removed. Ask whoever shared it for an updated link.
        </p>
        <Link
          href="/login"
          className="text-sm text-primary hover:underline"
        >
          Team sign-in &rarr;
        </Link>
      </div>
    </div>
  );
}
