import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  console.log("=== OAuth Callback Debug ===");
  console.log("Code received:", !!code);
  console.log("Error received:", error);
  console.log("Full URL:", request.url);

  // Get the base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
  console.log("Base URL:", baseUrl);

  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(`${baseUrl}/?error=oauth_error`);
  }

  if (!code) {
    console.error("No authorization code received");
    return NextResponse.redirect(`${baseUrl}/?error=no_code`);
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    console.log("Redirect URI:", redirectUri);

    console.log("Exchanging code for tokens...");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokens = await tokenResponse.json();
    console.log("Token response status:", tokenResponse.status);
    console.log("Token response ok:", tokenResponse.ok);
    console.log("Has access token:", !!tokens.access_token);
    console.log("Has refresh token:", !!tokens.refresh_token);

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", tokens);
      return NextResponse.redirect(`${baseUrl}/?error=token_exchange_failed`);
    }

    if (tokens.access_token) {
      console.log("Successfully received tokens, setting cookies...");

      // Create the response first
      const response = NextResponse.redirect(`${baseUrl}/?auth=success`);

      console.log("Setting access token cookie...");
      // Set cookies on the response
      response.cookies.set("google_access_token", tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: tokens.expires_in || 3600,
        sameSite: "lax",
        path: "/",
      });

      if (tokens.refresh_token) {
        console.log("Setting refresh token cookie...");
        response.cookies.set("google_refresh_token", tokens.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: "lax",
          path: "/",
        });
      } else {
        console.log("No refresh token received");
      }

      console.log("Setting authenticated flag cookie...");
      // Set a flag to indicate successful authentication
      response.cookies.set("google_authenticated", "true", {
        httpOnly: false, // This one can be read by client
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
        path: "/",
      });

      console.log("All cookies set successfully, redirecting...");
      return response;
    } else {
      console.error("No access token in response:", tokens);
      return NextResponse.redirect(`${baseUrl}/?error=no_access_token`);
    }
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(`${baseUrl}/?error=oauth_failed`);
  }
}
