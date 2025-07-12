import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  // Get the base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin

  if (error) {
    console.error("OAuth error:", error)
    return NextResponse.redirect(`${baseUrl}/?error=oauth_error`)
  }

  if (!code) {
    console.error("No authorization code received")
    return NextResponse.redirect(`${baseUrl}/?error=no_code`)
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/google/callback`

    console.log("Exchanging code for tokens...")
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
    })

    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", tokens)
      return NextResponse.redirect(`${baseUrl}/?error=token_exchange_failed`)
    }

    if (tokens.access_token) {
      console.log("Successfully received tokens")
      // Store tokens in cookies
      const cookieStore = await cookies()
      cookieStore.set("google_access_token", tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: tokens.expires_in || 3600,
        sameSite: "lax",
      })

      if (tokens.refresh_token) {
        cookieStore.set("google_refresh_token", tokens.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: "lax",
        })
      }

      // Set a flag to indicate successful authentication
      cookieStore.set("google_authenticated", "true", {
        httpOnly: false, // This one can be read by client
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
      })

      return NextResponse.redirect(`${baseUrl}/?auth=success`)
    } else {
      console.error("No access token in response:", tokens)
      return NextResponse.redirect(`${baseUrl}/?error=no_access_token`)
    }
  } catch (error) {
    console.error("OAuth callback error:", error)
    return NextResponse.redirect(`${baseUrl}/?error=oauth_failed`)
  }
}
