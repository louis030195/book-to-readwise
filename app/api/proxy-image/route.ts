import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Get the user's access token for authenticated requests
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("google_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Fetch the image with authentication
    let response = await fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Mozilla/5.0 (compatible; PhotoProxy/1.0)",
      },
    });

    // If image fetch fails with 401, try to refresh token and retry
    if (response.status === 401) {
      console.log("Image fetch failed with 401, attempting token refresh...");
      const refreshResponse = await fetch(`${request.nextUrl.origin}/api/auth/google/refresh`, {
        method: "POST",
      });

      if (refreshResponse.ok) {
        console.log("Token refreshed successfully, retrying image fetch...");
        // Get the refreshed token
        const refreshedCookieStore = await cookies();
        const refreshedAccessToken = refreshedCookieStore.get("google_access_token")?.value;
        
        if (refreshedAccessToken) {
          // Retry image fetch with refreshed token
          response = await fetch(imageUrl, {
            headers: {
              Authorization: `Bearer ${refreshedAccessToken}`,
              "User-Agent": "Mozilla/5.0 (compatible; PhotoProxy/1.0)",
            },
          });
        }
      }
    }

    if (!response.ok) {
      console.error(
        "Failed to fetch image:",
        response.status,
        response.statusText
      );
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: response.status }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error proxying image:", error);
    return NextResponse.json(
      { error: "Failed to proxy image" },
      { status: 500 }
    );
  }
}
