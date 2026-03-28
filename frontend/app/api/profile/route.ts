import { auth0 } from '@/lib/auth0';
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = session.accessToken;

    // Call backend to get display name from database
    const response = await fetch("http://localhost:8000/api/user/display-name", {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // If backend fails, return Auth0 name as fallback
      return NextResponse.json({
        name: session.user.name,
        email: session.user.email,
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
