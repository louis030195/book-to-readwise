import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("google_access_token")?.value;
  const refreshToken = cookieStore.get("google_refresh_token")?.value;
  const authenticated = cookieStore.get("google_authenticated")?.value;

  return NextResponse.json({
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    isAuthenticated: authenticated,
    accessTokenPreview: accessToken
      ? accessToken.substring(0, 20) + "..."
      : null,
    refreshTokenPreview: refreshToken
      ? refreshToken.substring(0, 20) + "..."
      : null,
  });
}
