import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts, movies, pitchTemplates } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { InfluencerPitchForm } from "./pitch-form";

export default async function InfluencerPitchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, id),
        eq(contacts.workspaceId, session.workspaceId),
      ),
    );

  if (!contact || contact.type !== "influencer") notFound();

  const [movieList, templates] = await Promise.all([
    db
      .select({ id: movies.id, title: movies.title, screenerUrl: movies.screenerUrl, trailerUrl: movies.trailerUrl })
      .from(movies)
      .where(eq(movies.workspaceId, session.workspaceId))
      .orderBy(movies.title),
    db
      .select({ id: pitchTemplates.id, name: pitchTemplates.name, subject: pitchTemplates.subject, body: pitchTemplates.body })
      .from(pitchTemplates)
      .where(eq(pitchTemplates.workspaceId, session.workspaceId))
      .orderBy(pitchTemplates.name),
  ]);

  return (
    <>
      <PageHeader
        title={`Pitch ${contact.name}`}
        description={[
          contact.primaryPlatform,
          contact.handleYoutube ?? contact.handleInstagram ?? contact.handleTiktok ?? null,
        ]
          .filter(Boolean)
          .join(" · ") || "Influencer outreach"}
      />
      <div className="mx-auto max-w-3xl p-8">
        <InfluencerPitchForm
          contactId={contact.id}
          contactName={contact.name}
          contactEmail={contact.email}
          contactPlatform={contact.primaryPlatform}
          movies={movieList}
          templates={templates}
        />
      </div>
    </>
  );
}
