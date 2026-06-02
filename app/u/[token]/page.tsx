import { verifyUnsubToken } from "@/lib/email/footer";
import { suppress } from "@/app/(app)/(pr)/email/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = await verifyUnsubToken(token);

  if (!decoded) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid unsubscribe link</CardTitle>
            <CardDescription>
              The link may be malformed or tampered with.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  await suppress({
    workspaceId: decoded.workspaceId,
    email: decoded.email,
    reason: "unsubscribe",
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You&apos;ve been unsubscribed</CardTitle>
          <CardDescription>
            We&apos;ve removed <strong>{decoded.email}</strong> from future
            outreach.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          You can close this tab.
        </CardContent>
      </Card>
    </div>
  );
}
