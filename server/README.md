# Framing Assistant AI Backend

Small local Node backend for Experimental Features / AI Wall Enhancement.

The mobile app calls:

```text
POST /api/ai/enhance-wall-photo
```

The backend calls Replicate server-side with `REPLICATE_API_TOKEN`. Do not put the
Replicate token in the Expo/mobile app.

## Environment

Create `server/.env` or repo-root `.env` from `server/.env.example`.

Required:

```text
REPLICATE_API_TOKEN=...
```

Optional:

```text
AI_BACKEND_PORT=8787
REPLICATE_MODEL=nightmareai/real-esrgan
REPLICATE_VERSION=
REPLICATE_IMAGE_INPUT_KEY=image
REPLICATE_PROMPT_INPUT_KEY=
REPLICATE_INPUT_JSON={"scale":2,"face_enhance":false}
REPLICATE_TIMEOUT_MS=120000
AI_BACKEND_CORS_ORIGIN=*
```

If `REPLICATE_VERSION` is set, the backend uses Replicate's versioned prediction
endpoint. Otherwise it uses the owner/model endpoint for `REPLICATE_MODEL`.

## Run Locally

```sh
npm run ai:server
```

Then point the Expo app at the backend:

```text
EXPO_PUBLIC_AI_BACKEND_URL=http://localhost:8787
```

For a physical device, use your Mac's LAN IP instead of `localhost`.

## Test

Health check:

```sh
curl http://localhost:8787/health
```

Multipart upload:

```sh
curl -X POST http://localhost:8787/api/ai/enhance-wall-photo \
  -F "image=@/path/to/wall-photo.jpg" \
  -F "enhancementMode=cleanWall" \
  -F 'settings={"preservePerspective":true,"cleanupWallMarks":true,"balanceLighting":true}'
```

JSON/base64:

```sh
curl -X POST http://localhost:8787/api/ai/enhance-wall-photo \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"...","mimeType":"image/jpeg","enhancementMode":"cleanWall","settings":{"balanceLighting":true}}'
```

Successful responses include one of:

```json
{
  "enhancedImageUrl": "https://...",
  "provider": "replicate",
  "metadata": {
    "model": "nightmareai/real-esrgan",
    "predictionId": "...",
    "processingStatus": "succeeded"
  }
}
```

or:

```json
{
  "enhancedImageBase64": "...",
  "mimeType": "image/jpeg",
  "provider": "replicate"
}
```
