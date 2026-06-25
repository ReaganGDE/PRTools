import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { changePassword } from "./actions";
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

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const jar = await cookies();
  const userId = jar.get("pending_pw_change_for")?.value;

  if (!userId) redirect("/login");

  const { error } = await searchParams;
  const errorMessage =
    error === "short"
      ? "Password must be at least 8 characters."
      : error === "mismatch"
        ? "Passwords don't match."
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Your administrator set a temporary password. Please choose a new one
            before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={changePassword} className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            {errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            )}
            <Button type="submit" className="w-full">
              Set password and sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
