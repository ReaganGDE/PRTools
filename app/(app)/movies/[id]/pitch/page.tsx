import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { movies, contacts, movieContacts } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { requireSectionAccess } from "@/lib/tool-access";
import { PageHeader } from "@/components/page-header";
import { PitchForm } from "./pitch-form";

function defaultBody(): string {
  return [
    "Hi {{first_name}},",
    "",
    "I wanted to share {{film_title}} with you.",
    "",
    "{{logline}}",
    "",
    "Trailer: {{trailer_url}}",
    "Screener: {{screener_url}} (password: {{screener_password}})",
    "",
    "Release date: {{release_date}}",
    "",
    "Happy to arrange an interview with {{director}} or send additional press materials. Let me know what works.",
    "",
    "Best,",
  ].join("\n");
}

export default async function PitchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSectionAccess("pr");
  const session = await requireSession();

  const [[movie], linked] = await Promise.all([
    db
      .select()
      .from(movies)
      .where(
        and(eq(movies.id, id), eq(movies.workspaceId, session.workspaceId)),
      ),
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        outlet: contacts.outlet,
        beat: contacts.beat,
        screenerSentAt: movieContacts.screenerSentAt,
      })
      .from(movieContacts)
      .innerJoin(contacts, eq(movieContacts.contactId, contacts.id))
      .where(eq(movieContacts.movieId, id))
      .orderBy(contacts.name),
  ]);

  if (!movie) notFound();

  const recipients = linked.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    outlet: c.outlet,
    beat: c.beat,
    screenerSentAt: c.screenerSentAt ? c.screenerSentAt.toISOString() : null,
  }));

  const defaultSubject = `Screener & press materials — ${movie.title}`;

  return (
    <>
      <PageHeader
        title={`Pitch — ${movie.title}`}
        description="Send a screener / press pitch to the contacts linked to this film."
      />
      <div className="mx-auto max-w-3xl p-8">
        <div className="mb-6">
          <Link
            href={`/movies/${id}`}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" /> Back to film
          </Link>
        </div>

        {recipients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              No press contacts linked to this film yet.
            </p>
            <Link
              href={`/movies/${id}`}
              className="mt-2 inline-block text-sm text-red-600 hover:underline dark:text-red-400"
            >
              Add press contacts first →
            </Link>
          </div>
        ) : (
          <PitchForm
            movieId={id}
            recipients={recipients}
            defaultSubject={defaultSubject}
            defaultBody={defaultBody()}
          />
        )}
      </div>
    </>
  );
}
