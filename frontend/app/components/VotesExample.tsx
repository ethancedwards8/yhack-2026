/**
 * Example: Frontend using Auth0 token to call backend API
 * 
 * This shows how the frontend should interact with the backend:
 * 1. User logs in via Auth0 (via /api/auth/login)
 * 2. Frontend gets the Auth0 token from the session
 * 3. Frontend calls backend API with token in Authorization header
 * 4. Backend validates token and queries data from Supabase (with RLS)
 */

'use client';

import { useEffect, useState } from 'react';
import { getAccessToken } from '@auth0/nextjs-auth0';

interface Vote {
  id: number;
  user_id: string;
  bill_id: number;
  vote: string;
}

export default function VotesExample() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVotes = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get the Auth0 access token from the session
        // This only works in Server Components or Route Handlers
        // For Client Components, use useUser() hook instead:
        // const { user, isLoading } = useUser();
        // Then pass the token via a route handler

        // Example using a Route Handler to get the token:
        const response = await fetch('/api/votes'); // We'll create this route handler
        
        if (!response.ok) {
          throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        setVotes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load votes');
      } finally {
        setLoading(false);
      }
    };

    fetchVotes();
  }, []);

  if (loading) return <p>Loading votes...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Your Votes</h1>
      
      {votes.length === 0 ? (
        <p>No votes yet. Start voting on bills!</p>
      ) : (
        <ul className="space-y-2">
          {votes.map((vote) => (
            <li
              key={vote.id}
              className="p-4 border border-gray-200 rounded flex justify-between items-center"
            >
              <span>Bill #{vote.bill_id}</span>
              <span
                className={`font-bold px-3 py-1 rounded ${
                  vote.vote === 'yes'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {vote.vote === 'yes' ? '✓ Yes' : '✗ No'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h2 className="font-bold mb-2">How this works:</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Frontend calls /api/votes (via Route Handler)</li>
          <li>Route Handler gets the Auth0 token from the session</li>
          <li>Route Handler calls backend: GET http://localhost:8000/api/votes</li>
          <li>Backend validates the token and queries Supabase</li>
          <li>Supabase RLS filters votes to current user only</li>
          <li>Data is returned to frontend (user's votes only)</li>
        </ol>
      </div>
    </div>
  );
}
