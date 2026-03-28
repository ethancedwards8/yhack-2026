/**
 * Route Handler: /api/votes
 * 
 * This bridges the frontend and backend:
 * - Gets Auth0 token from Next.js session
 * - Calls Flask backend API (on localhost:8000)
 * - Passes JWT in Authorization header
 * - Returns data to frontend
 */

import { getAccessToken } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  try {
    // Get the Auth0 access token from the session
    const { token } = await getAccessToken();

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - no token found' },
        { status: 401 }
      );
    }

    // Call the backend API with the JWT token
    const backendResponse = await fetch(`${BACKEND_URL}/api/votes`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.text();
      console.error(
        `Backend error: ${backendResponse.status}`,
        errorData
      );
      return NextResponse.json(
        { error: `Backend error: ${backendResponse.status}` },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Route handler error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get the Auth0 access token from the session
    const { token } = await getAccessToken();

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - no token found' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await req.json();

    // Call the backend API with the JWT token
    const backendResponse = await fetch(`${BACKEND_URL}/api/votes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.text();
      console.error(
        `Backend error: ${backendResponse.status}`,
        errorData
      );
      return NextResponse.json(
        { error: `Backend error: ${backendResponse.status}` },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Route handler error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
