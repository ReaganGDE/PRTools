import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You&apos;re signed in</CardTitle>
          <CardDescription>
            But you haven&apos;t joined a workspace yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          Ask a teammate to invite you. They can do that from{" "}
          <strong>Settings → Team</strong>.
        </CardContent>
      </Card>
    </div>
  );
}
