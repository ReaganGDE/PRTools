import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      workspaceId: string | null;
      role: "owner" | "admin" | "member" | "viewer";
      isOnboarding: boolean;
    } & DefaultSession["user"];
  }
}
