#!/bin/bash
# Test script for the Auth0 + Supabase + Backend integration

set -e

echo "🧪 Testing Auth0 + Supabase + Backend Integration"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

echo "Configuration:"
echo "  Backend:  $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""

# Test 1: Backend health check
echo -e "${BLUE}Test 1: Backend Health Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v curl &> /dev/null; then
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ Backend is running${NC}"
    else
        echo -e "${RED}✗ Backend health check failed (HTTP $response)${NC}"
        echo "  Make sure backend is running: docker run -p 8000:8000 yhack-backend"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ curl not found, skipping health check${NC}"
fi

echo ""

# Test 2: Frontend auth handler
echo -e "${BLUE}Test 2: Frontend Auth0 Handler Setup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "frontend/app/api/auth/[auth0]/route.ts" ]; then
    echo -e "${GREEN}✓ Auth0 handler exists${NC}"
else
    echo -e "${RED}✗ Auth0 handler not found${NC}"
    exit 1
fi

if [ -f "frontend/app/api/votes/route.ts" ]; then
    echo -e "${GREEN}✓ Votes API bridge exists${NC}"
else
    echo -e "${RED}✗ Votes API bridge not found${NC}"
fi

echo ""

# Test 3: Backend JWT validation
echo -e "${BLUE}Test 3: Backend JWT Validation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if grep -q "validate_token" backend/app/auth.py; then
    echo -e "${GREEN}✓ JWT validation module found${NC}"
else
    echo -e "${RED}✗ JWT validation not found${NC}"
    exit 1
fi

if grep -q "requires_auth" backend/app/auth.py; then
    echo -e "${GREEN}✓ @requires_auth decorator found${NC}"
else
    echo -e "${RED}✗ @requires_auth decorator not found${NC}"
fi

echo ""

# Test 4: Backend Supabase RLS client
echo -e "${BLUE}Test 4: Backend Supabase RLS Client${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "backend/app/supabase_rls.py" ]; then
    echo -e "${GREEN}✓ Supabase RLS client module found${NC}"
else
    echo -e "${RED}✗ Supabase RLS client not found${NC}"
    exit 1
fi

if grep -q "create_user_client" backend/app/supabase_rls.py; then
    echo -e "${GREEN}✓ create_user_client() function found${NC}"
else
    echo -e "${RED}✗ create_user_client() not found${NC}"
fi

echo ""

# Test 5: Frontend doesn't import Supabase
echo -e "${BLUE}Test 5: Frontend Supabase Independence${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! grep -r "@supabase/supabase-js" frontend/app frontend/lib 2>/dev/null | grep -v node_modules | grep -v ".next" | grep import > /dev/null; then
    echo -e "${GREEN}✓ Frontend does not import Supabase${NC}"
else
    echo -e "${RED}✗ WARNING: Frontend imports Supabase (should use backend API)${NC}"
fi

# Check package.json
if grep -q "@supabase/supabase-js" frontend/package.json; then
    echo -e "${RED}✗ @supabase/supabase-js is in package.json (should be removed)${NC}"
else
    echo -e "${GREEN}✓ Supabase removed from frontend dependencies${NC}"
fi

echo ""

# Test 6: Environment variables
echo -e "${BLUE}Test 6: Environment Variables${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MISSING=()

# Frontend checks
if [ -f "frontend/.env.local" ]; then
    if grep -q "AUTH0_DOMAIN" frontend/.env.local; then
        echo -e "${GREEN}✓ frontend/.env.local has AUTH0_DOMAIN${NC}"
    else
        MISSING+=("frontend AUTH0_DOMAIN")
    fi
else
    echo -e "${YELLOW}⚠ frontend/.env.local not found${NC}"
fi

# Backend checks
if [ -f "backend/.env" ]; then
    if grep -q "AUTH0_DOMAIN" backend/.env; then
        echo -e "${GREEN}✓ backend/.env has AUTH0_DOMAIN${NC}"
    else
        MISSING+=("backend AUTH0_DOMAIN")
    fi
    
    if grep -q "SUPABASE_URL" backend/.env; then
        echo -e "${GREEN}✓ backend/.env has SUPABASE_URL${NC}"
    else
        MISSING+=("backend SUPABASE_URL")
    fi
else
    echo -e "${YELLOW}⚠ backend/.env not found${NC}"
fi

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Missing environment variables:${NC}"
    for var in "${MISSING[@]}"; do
        echo "  - $var"
    done
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✨ Setup validation complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo "🚀 Next Steps:"
echo "  1. Start backend: docker run -p 8000:8000 yhack-backend"
echo "  2. Start frontend: npm run dev (in frontend/)"
echo "  3. Go to http://localhost:3000"
echo "  4. Click Login (should redirect to Auth0)"
echo "  5. After login, test API call: curl http://localhost:3000/api/votes"
echo ""

echo "📝 Testing without Auth0:"
echo "  To test backend directly without Auth0 setup:"
echo "  - Get an Auth0 token from jwt.io (create test token)"
echo "  - Run: curl -H 'Authorization: Bearer <TOKEN>' $BACKEND_URL/api/votes"
echo ""
