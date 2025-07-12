import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("google_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  console.log("=== Photos Picker Media Items Fetch ===");
  console.log("Session ID:", sessionId);
  console.log("Has access token:", !!accessToken);

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session ID is required" },
      { status: 400 }
    );
  }

  try {
    // Get the selected media items from the session
    const url = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`;
    console.log("Fetching from URL:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log("Photos Picker media items fetch failed:", errorData);

      // If user hasn't picked items yet, return a specific response
      if (
        errorData.error?.code === 400 &&
        errorData.error?.message?.includes("not picked media items")
      ) {
        return NextResponse.json(
          {
            error: "No photos selected yet",
            message: "Please select photos in the Google Photos Picker first",
            needsSelection: true,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: `Failed to fetch selected photos: ${
            errorData.error?.message || response.statusText
          }`,
        },
        { status: response.status }
      );
    }

    const mediaData = await response.json();
    console.log("Media data received:", JSON.stringify(mediaData, null, 2));

    return NextResponse.json(mediaData);
  } catch (error) {
    console.error("Error fetching selected photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch selected photos" },
      { status: 500 }
    );
  }
}
