#!/bin/bash

echo "🧪 Testing MongoDB API Endpoints on EasyPanel"
echo "=============================================="

# Replace with your actual EasyPanel domain
DOMAIN="your-easypanel-domain.com"

echo "1. Testing Database Health Check..."
curl -s "$DOMAIN/api/health" | head -200
echo -e "\n"

echo "2. Testing Database Connection..."
curl -s "$DOMAIN/api/dbtest" | head -200
echo -e "\n"

echo "3. Testing User Registration..."
curl -s -X POST "$DOMAIN/api/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser123","email":"test123@example.com"}' | head -200
echo -e "\n"

echo "4. Testing Users List..."
curl -s "$DOMAIN/api/users" | head -200
echo -e "\n"

echo "🎯 MongoDB Test Complete!"
echo "Expected Results:"
echo "✅ Health: {\"database\": \"connected\"}"
echo "✅ DBTest: {\"success\": true, \"userCount\": X}"  
echo "✅ Register: {\"success\": true, \"generatedPassword\": \"ABC123456xy\"}"
echo "✅ Users: {\"success\": true, \"users\": [...]}"