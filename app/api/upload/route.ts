import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireSessionWithCap } from "@/lib/auth-helpers";

// Client-direct upload to Vercel Blob. The client calls `upload()` from
// @vercel/blob/client which hits this route to mint a one-shot upload token,
// then PUTs the file straight to Blob storage.
export async function POST(request: Request): Promise<NextResponse> {
  await requireSessionWithCap("social.post.create");
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/*", "video/*"],
        maximumSizeInBytes: 1024 * 1024 * 1024, // 1 GB
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // No-op: we record the URL when the form submits.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 },
    );
  }
}
