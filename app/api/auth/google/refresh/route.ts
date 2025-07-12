import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("google_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: "Refresh token not found" },
      { status: 401 }
    );
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await response.json();

    if (!response.ok) {
      console.error("Token refresh failed:", tokenData);
      // If refresh fails, clear the auth cookies to force re-authentication
      cookieStore.delete("google_access_token");
      cookieStore.delete("google_refresh_token");
      cookieStore.delete("google_authenticated");
      return NextResponse.json(
        { error: "Failed to refresh token" },
        { status: 401 }
      );
    }

    const { access_token, expires_in } = tokenData;

    cookieStore.set("google_access_token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: expires_in,
      path: "/",
    });

    cookieStore.set("google_authenticated", "true", {
      secure: process.env.NODE_ENV === "production",
      maxAge: expires_in,
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Refresh token error:", error);
    return NextResponse.json(
      { error: "Internal server error during token refresh" },
      { status: 500 }
    );
  }
}
 