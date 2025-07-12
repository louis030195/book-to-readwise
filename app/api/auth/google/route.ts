import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  console.log("=== OAuth Route Debug ===");
  console.log("NEXT_PUBLIC_BASE_URL:", process.env.NEXT_PUBLIC_BASE_URL);
  console.log("Base URL:", baseUrl);
  console.log("Redirect URI:", redirectUri);
  console.log("Client ID:", clientId);

  const scope =
    "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `access_type=offline&` +
    `prompt=consent`;

  console.log("Full auth URL:", authUrl);

  return NextResponse.redirect(authUrl);
}
