import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { acceptInvite } from "@/lib/invites";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/invite/${token}`);
  }

  const result = await acceptInvite({ token, userId: session.user.id });

  if (result.ok) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invite problem</CardTitle>
          <CardDescription>{result.error}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          Ask the person who invited you to send a new link.
        </CardContent>
      </Card>
    </div>
  );
}
