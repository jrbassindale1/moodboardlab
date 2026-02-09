# Material Icon Generation Setup Guide

## Overview

This system automatically generates small, representative icons for every material in your materials library using the Google Gemini API (Imagen 3). Icons are generated in the background and cached in localStorage for performance.

## What's Been Implemented

### 1. Frontend Components

- **`utils/materialIconGenerator.ts`**: Core utility for generating icons via Gemini API
- **`hooks/useMaterialIcons.ts`**: React hook for managing icons with auto-generation
- **`components/MaterialIconManager.tsx`**: UI component showing generation progress
- **`components/MaterialIconDisplay.tsx`**: Components for displaying materials with icons
- **`App.tsx`**: Updated to include the MaterialIconManager

### 2. How It Works

1. **On app load**: The system checks which materials don't have icons
2. **Background generation**: After 2 seconds, it starts generating missing icons automatically
3. **Rate limiting**: 1.5 seconds between each request to avoid API rate limits
4. **Persistent storage**: Icons are saved to localStorage for fast reload
5. **Auto-detection**: When you add new materials to `constants.ts`, icons are generated automatically

## Backend API Updates Required

Your Azure Functions backend needs to support image generation. Update your `generate-moodboard` function to handle the new `image` mode.
`GEMINI_API_KEY` must be configured server-side in Function App settings only. Do not expose it in the frontend.

### Expected Request Format

```typescript
{
  "mode": "image",
  "payload": {
    "prompt": "Create a simple, minimalist material swatch icon...",
    "aspectRatio": "1:1",
    "numberOfImages": 1
  }
}
```

### Expected Response Format

```typescript
{
  "images": ["base64_encoded_image_data"]
  // OR
  // "images": ["data:image/png;base64,base64_encoded_image_data"]
}
```

### Backend Implementation Example (TypeScript)

Add this to your `moodboardlab-functions` project:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function generateImage(prompt: string): Promise<string> {
  // Use Gemini's Imagen 3 model for image generation
  const model = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-001' });

  const result = await model.generateContent({
    prompt: prompt,
    generationConfig: {
      numberOfImages: 1,
      aspectRatio: '1:1',
      outputFormat: 'image/png'
    }
  });

  // Extract base64 image data
  const response = await result.response;
  const image = response.images[0]; // Get first image

  return image.data; // Return base64 encoded image
}

// In your HTTP function handler:
if (mode === 'image') {
  const { prompt } = payload;
  const imageData = await generateImage(prompt);

  return {
    status: 200,
    body: JSON.stringify({
      images: [imageData]
    })
  };
}
```

### Alternative: Using Vertex AI

If you prefer to use Google Cloud's Vertex AI directly:

```typescript
import { ImageGenerationModel } from '@google-cloud/vertexai';

const model = new ImageGenerationModel('imagen-3.0-generate-001');

async function generateImage(prompt: string): Promise<string> {
  const result = await model.predict({
    instances: [{
      prompt: prompt,
    }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
    }
  });

  return result.predictions[0].bytesBase64Encoded;
}
```

## Testing

1. **Start your app**: `npm run dev`
2. **Check the console**: You should see: "Auto-generating icons for X materials..."
3. **Watch the progress**: A small widget appears in the bottom-right corner
4. **Check localStorage**: Open DevTools → Application → Local Storage → Look for `materialIcons`

## Usage Examples

### Display Material with Icon

```tsx
import { MaterialIconDisplay } from './components/MaterialIconDisplay';

function MyComponent() {
  return (
    <MaterialIconDisplay
      material={someMaterial}
      size={64}
      showName={true}
    />
  );
}
```

### Material Grid

```tsx
import { MaterialGrid } from './components/MaterialIconDisplay';

function MaterialSelector() {
  const [selected, setSelected] = useState<MaterialOption | null>(null);

  return (
    <MaterialGrid
      materials={MATERIAL_PALETTE}
      onSelectMaterial={setSelected}
      selectedMaterialId={selected?.id}
      iconSize={80}
    />
  );
}
```

### Get Icon Programmatically

```tsx
import { useMaterialIcons } from './hooks/useMaterialIcons';

function MyComponent() {
  const { getIcon, isGenerating } = useMaterialIcons(MATERIAL_PALETTE);

  const iconUrl = getIcon('steel-frame');

  return (
    <div>
      {isGenerating && <p>Generating icons...</p>}
      {iconUrl && <img src={iconUrl} alt="Material" />}
    </div>
  );
}
```

## Adding New Materials

When you add a new material to `constants.ts`:

1. Add the material to `MATERIAL_PALETTE` array
2. The system automatically detects it on next app load
3. Icon generation starts automatically after 2 seconds
4. No manual intervention needed!

Example:

```typescript
export const MATERIAL_PALETTE: MaterialOption[] = [
  // ... existing materials
  {
    id: 'new-material',
    name: 'New Material',
    tone: '#abc123',
    finish: 'Polished finish',
    description: 'A new material with unique properties',
    keywords: ['new', 'material', 'modern'],
    category: 'finish',
    carbonIntensity: 'low'
  }
];
```

## Manual Controls

The MaterialIconManager component provides buttons to:

- **Generate Missing Icons**: Only generate icons for materials that don't have them
- **Regenerate All Icons**: Re-create all icons (useful if you want different styles)

## Performance Considerations

- **LocalStorage limit**: ~5-10MB total. Each icon is ~50-100KB base64 encoded
- **Max materials with icons**: ~50-100 materials before storage issues
- **Generation time**: ~2 seconds per icon = ~10 minutes for 200+ materials
- **Caching**: Icons persist between sessions, only generated once

## Troubleshooting

### Icons not generating?

1. Check browser console for errors
2. Verify `GEMINI_API_KEY` is set in Azure Functions app settings (server-side only)
3. Check that your backend supports the `image` mode
4. Verify API rate limits haven't been hit

### Icons look wrong?

You can customize the prompt in `utils/materialIconGenerator.ts` in the `createIconPrompt` function:

```typescript
function createIconPrompt(material: MaterialIconRequest): string {
  return `Your custom prompt here...`;
}
```

### Clear cached icons:

```javascript
// In browser console:
localStorage.removeItem('materialIcons');
localStorage.removeItem('materialIconsTimestamp');
// Reload page
```

## Cost Estimates

Google Cloud Imagen 3 pricing (as of 2024):
- ~$0.04 per image
- 200 materials = ~$8 one-time cost
- Icons cached forever in localStorage

## Future Enhancements

Potential improvements:

1. **Batch generation**: Generate multiple icons in parallel
2. **Cloud storage**: Store icons in Azure Blob Storage instead of localStorage
3. **Compression**: Use WebP format for smaller file sizes
4. **CDN delivery**: Serve pre-generated icons from CDN
5. **Style consistency**: Fine-tune prompts for more consistent visual style
6. **Manual upload**: Allow uploading custom icons for specific materials
