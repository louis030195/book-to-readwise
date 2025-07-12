import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("google_access_token")?.value;

  console.log("=== Photos Picker Session Creation ===");
  console.log("Has access token:", !!accessToken);
  console.log(
    "Access token preview:",
    accessToken ? accessToken.substring(0, 20) + "..." : "none"
  );

  if (!accessToken) {
    console.log("No access token found");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    console.log("Creating Photos Picker session...");
    // Create a new Photos Picker session
    const response = await fetch(
      "https://photospicker.googleapis.com/v1/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Optional: Configure the picker session
          // You can add configuration options here
        }),
      }
    );

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Failed to parse error" }));
      console.error("Photos Picker session creation failed:", errorData);
      console.error(
        "Response headers:",
        Object.fromEntries(response.headers.entries())
      );
      return NextResponse.json(
        { error: "Failed to create picker session", details: errorData },
        { status: response.status }
      );
    }

    const sessionData = await response.json();
    console.log("Photos Picker session created successfully:", sessionData);

    return NextResponse.json(sessionData);
  } catch (error) {
    console.error("Error creating Photos Picker session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
