import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            We&apos;ll email you a magic link. No password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorBanner searchParams={searchParams} />
          <form
            action={async (formData: FormData) => {
              "use server";
              const callback =
                (await searchParams).callbackUrl ?? "/dashboard";
              await signIn("resend", {
                email: formData.get("email") as string,
                redirectTo: callback,
              });
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </div>
            <Button type="submit">Email me a link</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

async function ErrorBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
      {error === "AccessDenied"
        ? "Access denied. Your email isn't on the invite list yet."
        : "Something went wrong. Try again."}
    </div>
  );
}
