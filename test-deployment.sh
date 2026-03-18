#!/bin/bash

# Deployment Test Script
# Tests upload and OCR functionality after deployment

echo "🚀 Testing Grade AI Deployment..."

# Get the base URL (first argument or default to localhost)
# Usage examples:
#   ./test-deployment.sh                    # Tests localhost:3000
#   ./test-deployment.sh http://localhost:3000  # Tests localhost
#   ./test-deployment.sh https://grade-ai-system.vercel.app  # Tests production
BASE_URL=${1:-"http://localhost:3000"}

echo "📍 Testing against: $BASE_URL"

# Test 1: Health Check
echo -e "\n1️⃣ Health Check..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed: $HEALTH_STATUS"
    echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
fi

# Test 2: Upload Test (create a test image)
echo -e "\n2️⃣ Testing Upload..."
TEST_IMAGE="/tmp/test-upload.jpg"

# Create a simple test image (requires ImageMagick or convert)
if command -v convert &> /dev/null; then
    convert -size 400x300 xc:white -pointsize 20 -fill black -gravity center \
            -annotate +0+0 "Test Answer\nThis is a test\nfor OCR" "$TEST_IMAGE"
else
    echo "⚠️  Cannot create test image (ImageMagick not available)"
    echo "   Please create a test image manually at $TEST_IMAGE"
fi

if [ -f "$TEST_IMAGE" ]; then
    UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload" \
        -F "file=@$TEST_IMAGE" \
        -F "submissionId=test-$(date +%s)" \
        -F "questionNumber=1")
    
    UPLOAD_SUCCESS=$(echo "$UPLOAD_RESPONSE" | grep -o '"success":true' | head -1)
    FILE_PATH=$(echo "$UPLOAD_RESPONSE" | grep -o '"filePath":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$UPLOAD_SUCCESS" = "true" ] && [ "$FILE_PATH" != "" ]; then
        echo "✅ Upload successful: $FILE_PATH"
        
        # Test 3: OCR Test
        echo -e "\n3️⃣ Testing OCR..."
        OCR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/ocr" \
            -H "Content-Type: application/json" \
            -d "{\"filePath\":\"$FILE_PATH\",\"questionText\":\"What is this text?\"}")
        
        OCR_SUCCESS=$(echo "$OCR_RESPONSE" | grep -o '"success":true' | head -1)
        CONFIDENCE=$(echo "$OCR_RESPONSE" | grep -o '"confidence":"[^"]*"' | cut -d'"' -f4)
        TEXT_LENGTH=$(echo "$OCR_RESPONSE" | grep -o '"text":"[^"]*"' | cut -d'"' -f4 | wc -c)
        
        if [ "$OCR_SUCCESS" = "true" ]; then
            echo "✅ OCR successful"
            echo "   Confidence: $CONFIDENCE"
            echo "   Text length: $TEXT_LENGTH chars"
        else
            echo "❌ OCR failed"
            echo "$OCR_RESPONSE" | jq . 2>/dev/null || echo "$OCR_RESPONSE"
        fi
    else
        echo "❌ Upload failed"
        echo "$UPLOAD_RESPONSE" | jq . 2>/dev/null || echo "$UPLOAD_RESPONSE"
    fi
    
    # Cleanup
    rm -f "$TEST_IMAGE"
else
    echo "❌ No test image available"
fi

# Test 4: API Endpoints Check
echo -e "\n4️⃣ Checking API Endpoints..."
ENDPOINTS=("/api/exams" "/api/submissions" "/api/teachers")

for endpoint in "${ENDPOINTS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
    if [ "$STATUS" = "200" ]; then
        echo "✅ $endpoint - OK"
    else
        echo "❌ $endpoint - $STATUS"
    fi
done

echo -e "\n🎯 Test complete!"
echo "📊 Full health report: $BASE_URL/api/health"
