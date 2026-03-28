#!/bin/bash
# Test script to validate Auth0 + Supabase RLS migration
# Run this after completing the AUTH0_SUPABASE_MIGRATION.md setup

set -e

echo "🔍 Auth0 + Supabase RLS Migration Validation"
echo "=============================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check environment variables
echo "📋 Test 1: Environment Variables"
echo "--------------------------------"

MISSING_VARS=()

check_env() {
    if [ -z "${!1}" ]; then
        MISSING_VARS+=("$1")
        echo "  ❌ $1 is missing"
    else
        echo "  ✅ $1 is set"
    fi
}

check_env "AUTH0_DOMAIN"
check_env "AUTH0_CLIENT_ID"
check_env "AUTH0_CLIENT_SECRET"
check_env "AUTH0_SECRET"
check_env "NEXT_PUBLIC_SUPABASE_URL"
check_env "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
check_env "LEGISCAN_API_KEY"

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ Missing environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "⚠️  Set these variables in .env.local (frontend) or .env (backend)"
    exit 1
fi

echo ""

# Test 2: Validate Auth0 Domain Format
echo "🔐 Test 2: Auth0 Domain Validation"
echo "-----------------------------------"

if [[ $AUTH0_DOMAIN =~ ^dev-[a-zA-Z0-9]+\.us\.auth0\.com$ ]]; then
    echo "  ✅ AUTH0_DOMAIN format is correct"
else
    echo "  ⚠️  AUTH0_DOMAIN format seems unexpected: $AUTH0_DOMAIN"
    echo "      Expected format: dev-XXXXXXX.us.auth0.com"
fi

echo ""

# Test 3: Check if JWKS is accessible
echo "🌐 Test 3: Auth0 JWKS Accessibility"
echo "------------------------------------"

JWKS_URL="https://${AUTH0_DOMAIN}/.well-known/jwks.json"

if command -v curl &> /dev/null; then
    response=$(curl -s -o /dev/null -w "%{http_code}" "$JWKS_URL")
    if [ "$response" = "200" ]; then
        echo "  ✅ JWKS endpoint is accessible (HTTP $response)"
    else
        echo "  ❌ JWKS endpoint returned HTTP $response"
        echo "      URL: $JWKS_URL"
    fi
else
    echo "  ⚠️  curl not installed, skipping JWKS check"
fi

echo ""

# Test 4: Check if backend is running (optional)
echo "🚀 Test 4: Backend Health Check"
echo "--------------------------------"

if command -v curl &> /dev/null; then
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
    if [ "$response" = "200" ]; then
        echo "  ✅ Backend is running on localhost:8000"
    else
        echo "  ⚠️  Cannot reach backend (HTTP $response)"
        echo "      Make sure backend is running: cd backend && python -m app.main"
    fi
else
    echo "  ⚠️  curl not installed, skipping backend health check"
fi

echo ""

# Test 5: Check if frontend dependencies are installed
echo "📦 Test 5: Frontend Dependencies"
echo "--------------------------------"

if [ -d "frontend/node_modules" ]; then
    echo "  ✅ Frontend node_modules found"
    
    if grep -q "@auth0/nextjs-auth0" frontend/package.json; then
        echo "  ✅ @auth0/nextjs-auth0 is in package.json"
    else
        echo "  ❌ @auth0/nextjs-auth0 not found in package.json"
    fi
    
    if grep -q "@supabase/supabase-js" frontend/package.json; then
        echo "  ✅ @supabase/supabase-js is in package.json"
    else
        echo "  ❌ @supabase/supabase-js not found in package.json"
    fi
else
    echo "  ⚠️  Frontend node_modules not found. Run: cd frontend && npm install"
fi

echo ""

# Test 6: Check if backend has auth.py
echo "🔑 Test 6: Backend Auth Module"
echo "------------------------------"

if [ -f "backend/app/auth.py" ]; then
    echo "  ✅ backend/app/auth.py exists"
    
    if grep -q "requires_auth" backend/app/auth.py; then
        echo "  ✅ @requires_auth decorator found"
    else
        echo "  ❌ @requires_auth decorator not found"
    fi
    
    if grep -q "validate_token" backend/app/auth.py; then
        echo "  ✅ validate_token function found"
    else
        echo "  ❌ validate_token function not found"
    fi
else
    echo "  ❌ backend/app/auth.py not found"
fi

echo ""

# Test 7: Check if Flask routes are protected
echo "🛡️  Test 7: Protected Routes Check"
echo "----------------------------------"

if [ -f "backend/app/main.py" ]; then
    if grep -q "@requires_auth" backend/app/main.py; then
        count=$(grep -c "@requires_auth" backend/app/main.py)
        echo "  ✅ Found $count @requires_auth decorators in main.py"
    else
        echo "  ⚠️  No @requires_auth decorators found (public routes only)"
    fi
else
    echo "  ❌ backend/app/main.py not found"
fi

echo ""
echo -e "${GREEN}✨ Validation complete!${NC}"
echo ""
echo "📚 Next Steps:"
echo "  1. If all checks passed ✅, proceed with manual testing:"
echo "     - Open http://localhost:3000 in your browser"
echo "     - Click 'Login' and authenticate with Auth0"
echo "     - Inspect DevTools → Application → Cookies → auth0-session"
echo ""
echo "  2. Test backend authentication:"
echo "     TOKEN=\$(curl http://localhost:3000/api/auth/me | jq -r '.token')"
echo "     curl -H \"Authorization: Bearer \$TOKEN\" http://localhost:8000/search?q=healthcare"
echo ""
echo "  3. For detailed setup, see: AUTH0_SUPABASE_MIGRATION.md"
echo ""
