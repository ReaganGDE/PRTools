import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent you a sign-in link. Click it to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          You can close this tab.
        </CardContent>
      </Card>
    </div>
  );
}
