import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

async function fetchWithRefresh(
  url: string,
  options: RequestInit,
  req: NextRequest
): Promise<Response> {
  let accessToken = (await cookies()).get("google_access_token")?.value;
  options.headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
  };

  let response = await fetch(url, options);

  if (response.status === 401) {
    // Token likely expired, try to refresh
    const refreshResponse = await fetch(
      new URL("/api/auth/google/refresh", req.url).toString(),
      {
        method: "POST",
      }
    );

    if (!refreshResponse.ok) {
      // Refresh failed, propagate error
      return response;
    }

    // Refresh successful, retry the original request with the new token
    accessToken = (await cookies()).get("google_access_token")?.value;
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    };
    response = await fetch(url, options);
  }

  return response;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("google_access_token")?.value;
  const refreshToken = cookieStore.get("google_refresh_token")?.value;
  const authenticated = cookieStore.get("google_authenticated")?.value;

  console.log("=== Photo List Debug ===");
  console.log("Has access token:", !!accessToken);
  console.log("Has refresh token:", !!refreshToken);
  console.log("Is authenticated:", authenticated);
  console.log(
    "Access token preview:",
    accessToken ? accessToken.substring(0, 20) + "..." : "none"
  );

  if (!accessToken) {
    console.log("No access token found, returning 401");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Try a simpler API call first to test access
    console.log("Testing basic API access...");
    const testResponse = await fetch(
      "https://photoslibrary.googleapis.com/v1/albums",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log("Albums API response status:", testResponse.status);
    if (!testResponse.ok) {
      const testError = await testResponse.json().catch(() => ({}));
      console.log("Albums API error:", testError);
    }

    // Now try the main media items call
    console.log("Trying media items API...");
    const response = await fetch(
      "https://photoslibrary.googleapis.com/v1/mediaItems",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Failed to parse error from Google" }));
      console.error("Google Photos API error:", errorData);
      console.error("Response status:", response.status);
      console.error(
        "Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      // Let's also try with a different endpoint format
      console.log("Trying alternative endpoint...");
      const altResponse = await fetch(
        "https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=10",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log("Alternative endpoint status:", altResponse.status);
      if (!altResponse.ok) {
        const altError = await altResponse.json().catch(() => ({}));
        console.log("Alternative endpoint error:", altError);
      }

      return NextResponse.json(
        {
          error: `Failed to fetch photos: ${
            errorData.error?.message || response.statusText
          }`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter for images only and recent photos
    const photos =
      data.mediaItems
        ?.filter((item: any) => item.mimeType.startsWith("image/"))
        .slice(0, 50) || [];

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
