# Material Icon System - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                     React App                           │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  MaterialIconManager Component                   │  │   │
│  │  │  - Shows progress                                 │  │   │
│  │  │  - Provides manual controls                       │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                         │                                │   │
│  │                         ▼                                │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  useMaterialIcons Hook                           │  │   │
│  │  │  - Manages icon state                            │  │   │
│  │  │  - Triggers auto-generation                      │  │   │
│  │  │  - Provides icon getter                          │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │           │                    │                         │   │
│  │           │                    │                         │   │
│  │           ▼                    ▼                         │   │
│  │  ┌───────────────┐   ┌──────────────────────────┐      │   │
│  │  │  localStorage │   │  materialIconGenerator   │      │   │
│  │  │  - Cache      │◄──┤  - Generate prompts      │      │   │
│  │  │  - Icons      │   │  - Call API               │      │   │
│  │  │  - Metadata   │   │  - Process responses      │      │   │
│  │  └───────────────┘   └──────────────────────────┘      │   │
│  │                                  │                       │   │
│  └──────────────────────────────────┼──────────────────────┘   │
│                                     │                           │
└─────────────────────────────────────┼───────────────────────────┘
                                      │
                                      │ HTTPS POST
                                      │ /api/generate-moodboard
                                      │ { mode: "image", ... }
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Azure Functions Backend                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  HTTP Trigger: generate-moodboard                         │  │
│  │                                                            │  │
│  │  if (mode === "image") {                                  │  │
│  │    const model = genAI.getGenerativeModel({               │  │
│  │      model: 'imagen-3.0-generate-001'                     │  │
│  │    });                                                     │  │
│  │    return await model.generateContent(...)                │  │
│  │  }                                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            │ API Key: GEMINI_API_KEY
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Google Gemini API                              │
│                   (Imagen 3 Model)                               │
│                                                                  │
│  Input: Text prompt describing material                         │
│  Output: Base64 encoded PNG image (512x512)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Initial Load

```
1. App loads
   └─> useMaterialIcons hook initializes
       └─> loadMaterialIcons() reads from localStorage
           └─> Returns cached icons (instant!)

2. After 2 second delay
   └─> Check for missing materials
       └─> If missing found:
           └─> Start background generation
               └─> For each missing material:
                   ├─> Create AI prompt
                   ├─> Call Azure Function
                   │   └─> Azure calls Gemini API
                   │       └─> Returns base64 image
                   ├─> Store in localStorage
                   ├─> Update React state
                   └─> Wait 1.5s (rate limiting)
```

### When New Material Added

```
1. Developer adds material to MATERIAL_PALETTE in constants.ts

2. User reloads app
   └─> useMaterialIcons detects new material (ID not in cache)
       └─> After 2 seconds, starts generation for new material only
           └─> Generates icon → Caches → Done!

3. All subsequent loads use cached icon (instant)
```

### Manual Regeneration

```
User clicks "Regenerate All Icons"
  └─> regenerateIcons() function called
      └─> Generates icons for all materials
          └─> Overwrites existing icons in cache
              └─> Updates UI with new icons
```

## Component Hierarchy

```
App.tsx
  │
  ├─> Navbar
  ├─> Page Components (Concept, Moodboard, etc.)
  │
  ├─> MaterialIconManager (Fixed position, bottom-right)
  │     │
  │     └─> useMaterialIcons hook
  │           ├─> icons Map<string, MaterialIcon>
  │           ├─> isGenerating boolean
  │           ├─> progress object
  │           └─> Functions (getIcon, regenerateIcons, etc.)
  │
  └─> Footer
```

## Material Display Components

```
MaterialIconDisplay
  ├─> Displays single material with icon
  └─> Props: material, size, showName, onClick

MaterialGrid
  ├─> Grid of MaterialIconDisplay components
  └─> Props: materials[], onSelectMaterial, selectedMaterialId

MaterialDropdownOption
  ├─> Material option for dropdowns
  └─> Props: material, isSelected
```

## Storage Structure

### localStorage Keys

```typescript
// Key: 'materialIcons'
// Value: JSON string of MaterialIconStorage
{
  "steel-frame": {
    "id": "steel-frame",
    "dataUri": "data:image/png;base64,iVBORw0KG...",
    "generatedAt": 1704067200000
  },
  "glulam-structure": {
    "id": "glulam-structure",
    "dataUri": "data:image/png;base64,iVBORw0KG...",
    "generatedAt": 1704067203500
  },
  // ... more materials
}

// Key: 'materialIconsTimestamp'
// Value: string timestamp
"1704067200000"
```

## API Request/Response Flow

### Request to Azure Function

```typescript
POST /api/generate-moodboard
Content-Type: application/json

{
  "mode": "image",
  "payload": {
    "prompt": "Create a simple, minimalist material swatch icon of Steel Frame (Painted). Style: Clean, professional architectural material sample...",
    "aspectRatio": "1:1",
    "numberOfImages": 1
  }
}
```

### Response from Azure Function

```typescript
200 OK
Content-Type: application/json

{
  "images": [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA..."
    // OR just the base64 string without data URI prefix
    // "iVBORw0KGgoAAAANSUhEUgAAA..."
  ]
}
```

## State Management

```
useMaterialIcons Hook State:
├─> icons: Map<string, MaterialIcon>
│   └─> Updated when: Load from storage, Generate new, Regenerate
│
├─> isGenerating: boolean
│   └─> true during API calls, false when idle
│
├─> progress: { current, total, materialName }
│   └─> Updated during generation for progress bar
│
└─> error: string | null
    └─> Set when generation fails, null when successful
```

## Error Handling

```
Try to generate icon
  │
  ├─> Success
  │   └─> Store in cache
  │       └─> Update UI
  │
  └─> Failure
      ├─> Log error to console
      ├─> Set error state (shows in UI)
      ├─> Continue with next material (skip failed one)
      └─> Material shows without icon (fallback to color swatch)
```

## Performance Optimizations

1. **Caching Strategy**
   - Icons stored in localStorage (persistent)
   - Only generate once per material
   - Instant load on subsequent visits

2. **Rate Limiting**
   - 1.5 second delay between requests
   - Prevents API throttling
   - Background processing doesn't block UI

3. **Lazy Loading**
   - Icons don't block app initialization
   - 2 second delay before auto-generation starts
   - Progressive enhancement approach

4. **Fallback Display**
   - Shows color swatch while icon loading
   - App fully functional without icons
   - Graceful degradation

## Security Considerations

1. **API Key Protection**
   - GEMINI_API_KEY stored in Azure Function App Settings
   - Never exposed to frontend/browser
   - Calls routed through backend

2. **Data Validation**
   - Validate image data before storing
   - Check data URI format
   - Sanitize material descriptions in prompts

3. **Storage Limits**
   - Monitor localStorage usage
   - Handle quota exceeded errors
   - Clear old icons if needed

## Scalability

### Current Limits
- **Materials**: ~50-100 (localStorage limit)
- **Storage**: ~5-10MB total
- **Generation**: Sequential (one at a time)

### Future Improvements
- Move to Azure Blob Storage for icons
- Parallel generation (batch requests)
- CDN delivery for pre-generated icons
- Server-side caching layer
- Icon compression (WebP format)
