import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("google_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: "No access token found" },
      { status: 401 }
    );
  }

  try {
    // Use Google's tokeninfo endpoint to check the token details
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
    );
    const tokenInfo = await response.json();

    return NextResponse.json(tokenInfo);
  } catch (error) {
    console.error("Error checking token info:", error);
    return NextResponse.json(
      { error: "Failed to check token info" },
      { status: 500 }
    );
  }
}
