# Framing Assistant AI Backend

Small local Node backend for Experimental Features / AI Wall Enhancement.

AI Wall Enhancement is calibration-safe wall-photo cleanup. It is not room
generation. The backend prompt/config is built around:

- preserving room geometry and wall proportions
- preserving object scale, furniture placement, trim, windows, and doors
- preserving reference objects such as 8.5 x 11 paper or A4 paper
- preserving calibration trust for artwork placement
- cleaning lighting/noise without hallucinating a redesigned room

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

Uploaded wall photos are resized server-side before being sent to Replicate:

- max total pixels: `1,900,000`
- aspect ratio preserved
- no upscaling
- JPEG output quality: `92`

The original wall photo stays in the app. Only the temporary image payload sent to
Replicate is resized.

If `REPLICATE_VERSION` is set, the backend uses Replicate's versioned prediction
endpoint. Otherwise it uses the owner/model endpoint for `REPLICATE_MODEL`.

## Run Locally

Install backend-only dependencies once:

```sh
npm --prefix server install
```

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

Debug config, without exposing the token:

```sh
curl http://localhost:8787/debug/config
```

Multipart upload:

```sh
curl -X POST http://localhost:8787/api/ai/enhance-wall-photo \
  -F "image=@/path/to/wall-photo.jpg" \
  -F "enhancementMode=cleanWall" \
  -F 'settings={"preserveGeometry":true,"preserveScaleRelationships":true,"preserveReferenceObjects":true,"preservePerspectiveConsistency":true,"preserveWallCalibration":true,"cleanupLighting":true,"cleanupNoise":true,"mildPerspectiveCorrection":false}'
```

JSON/base64:

```sh
curl -X POST http://localhost:8787/api/ai/enhance-wall-photo \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"...","mimeType":"image/jpeg","enhancementMode":"cleanWall","settings":{"cleanupLighting":true,"preserveWallCalibration":true}}'
```

Local model test, without the mobile app:

```sh
npm run ai:test -- /path/to/wall-photo.jpg
```

Outputs are saved to `server/test-output/`:

- enhanced image file
- matching JSON metadata file with model, runtime, preprocessing dimensions,
  resolved enhancement intent, and Replicate prediction metadata

Switch models with env vars or flags:

```sh
REPLICATE_MODEL=owner/model npm run ai:test -- /path/to/wall-photo.jpg
npm run ai:test -- /path/to/wall-photo.jpg --model owner/model --version replicate-version-id
```

For prompt-capable models, set the expected prompt key:

```sh
npm run ai:test -- /path/to/wall-photo.jpg --prompt-input-key prompt
```

Successful responses include one of:

```json
{
  "enhancedImageUrl": "https://...",
  "provider": "replicate",
  "metadata": {
    "model": "nightmareai/real-esrgan",
    "predictionId": "...",
    "processingStatus": "succeeded",
    "intent": {
      "preserveGeometry": true,
      "preserveScaleRelationships": true,
      "preserveReferenceObjects": true,
      "preservePerspectiveConsistency": true,
      "preserveWallCalibration": true,
      "cleanupLighting": true,
      "cleanupNoise": true,
      "mildPerspectiveCorrection": false
    }
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

## Debugging

Every `POST /api/ai/enhance-wall-photo` request gets a request id like
`wall-enhance-...`. The backend logs:

- request received
- parsed upload/image field, MIME type, and size
- preprocessing original dimensions, resized dimensions, and total pixels
- enhancement mode and settings
- geometry-preserving enhancement goal and resolved intent
- Replicate model/version/config
- prediction start, prediction id, status changes, output shape
- final success or error response

Error responses include the same request id so the mobile alert can be matched to
the terminal logs. Logs never print `REPLICATE_API_TOKEN` or request headers.

## Pipeline Direction

The current prototype still defaults to `nightmareai/real-esrgan`, which is an
upscaling/detail model. It can improve some wall photos, but it does not reason
about room geometry. The intended future pipeline is stored in
`server/wallEnhancementIntent.js`:

1. perspective cleanup, only when calibration-safe
2. lighting cleanup
3. detail enhancement/upscale

Future model/provider integrations should honor the same intent before adding
new stages.
