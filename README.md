# HotBillsNearYou.com

This project is a civic engagement app that helps users explore and react to state legislation in a swipe-based interface. Users can quickly vote on bills, view matches with other users based on voting patterns and bias range, and track their own voting history in a simple, fast workflow.

docker instructions:

```bash
docker build -t yhack-backend .
docker run -p 8000:8000 yhack-backend
```

## Technology used

The backend is built with Python and Flask, with Supabase used for authentication and database operations, including RPC functions for atomic updates and matching queries. The frontend is built with Next.js, React, and TypeScript, with Framer Motion for swipe interactions and animated card behavior, plus Supabase client integrations for authenticated user flows.
