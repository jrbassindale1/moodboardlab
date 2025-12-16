# Material Icons - Quick Start Guide

## 🚀 Get Up and Running in 5 Minutes

### Step 1: Update Your Backend (Required)

Your Azure Function needs to support image generation. Add this to your `generate-moodboard` function:

```typescript
// In your Azure Function
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function (context, req) {
  const { mode, payload } = req.body;

  if (mode === 'image') {
    const model = genAI.getGenerativeModel({
      model: 'imagen-3.0-generate-001'
    });

    const result = await model.generateContent({
      prompt: payload.prompt,
      generationConfig: {
        numberOfImages: 1,
        aspectRatio: '1:1'
      }
    });

    const imageData = result.response.images[0].data;

    context.res = {
      status: 200,
      body: { images: [imageData] }
    };
    return;
  }

  // ... your existing text mode handling
}
```

**Deploy your updated function to Azure.**

### Step 2: Test the System

1. **Start your app:**
   ```bash
   npm run dev
   ```

2. **Open in browser:**
   - Go to http://localhost:5173
   - Open DevTools Console (F12)

3. **Watch for auto-generation:**
   - After 2 seconds, you'll see: "Auto-generating icons for X materials..."
   - A small widget appears in bottom-right corner
   - Icons generate one by one

4. **Verify it's working:**
   - Check console for progress messages
   - Check localStorage: `localStorage.getItem('materialIcons')`
   - You should see base64 image data

### Step 3: Use Icons in Your UI

**Add to any component:**

```tsx
import { MaterialIconDisplay } from './components/MaterialIconDisplay';
import { MATERIAL_PALETTE } from './constants';

function MyComponent() {
  const material = MATERIAL_PALETTE[0]; // Pick any material

  return (
    <MaterialIconDisplay
      material={material}
      size={64}
      showName={true}
    />
  );
}
```

**That's it!** Icons will appear automatically.

## 🧪 Quick Tests

### Test 1: Single Icon Generation

```typescript
// In browser console:
const test = await fetch('/api/generate-moodboard', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'image',
    payload: {
      prompt: 'Simple brick texture icon, minimalist, white background',
      aspectRatio: '1:1',
      numberOfImages: 1
    }
  })
});

const result = await test.json();
console.log(result); // Should have images array
```

### Test 2: Clear Cache and Regenerate

```typescript
// In browser console:
localStorage.removeItem('materialIcons');
localStorage.removeItem('materialIconsTimestamp');
// Reload page - icons will regenerate
```

### Test 3: View Demo Page

```tsx
// Temporarily in App.tsx:
import { MaterialIconDemo } from './components/MaterialIconDemo';

return (
  <div>
    <MaterialIconDemo />
  </div>
);
```

## 📋 Checklist

- [ ] Backend updated to support `mode: "image"`
- [ ] `GEMINI_API_KEY` set in Azure Function App Settings
- [ ] Backend deployed to Azure
- [ ] Frontend app running (`npm run dev`)
- [ ] MaterialIconManager visible in bottom-right corner
- [ ] Console shows icon generation progress
- [ ] localStorage contains materialIcons key
- [ ] Icons display in UI components

## ❓ Troubleshooting

### Icons not generating?

**Problem**: No icons appearing, no progress shown

**Solution**:
```typescript
// 1. Check backend is running
// 2. Check console for errors
// 3. Test API manually:
fetch('your-api-url/api/generate-moodboard', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'image',
    payload: { prompt: 'test', aspectRatio: '1:1', numberOfImages: 1 }
  })
}).then(r => r.json()).then(console.log);
```

### Backend error "model not found"?

**Problem**: API returns error about model

**Solution**: Make sure you're using the correct model name:
- `imagen-3.0-generate-001` (for Vertex AI)
- Or check Gemini API docs for latest model names

### Storage quota exceeded?

**Problem**: localStorage is full

**Solution**:
```typescript
// Clear old icons:
localStorage.removeItem('materialIcons');
// Or implement cloud storage (see advanced docs)
```

## 🎨 Quick Customization

### Change Icon Style

Edit `utils/materialIconGenerator.ts`:

```typescript
function createIconPrompt(material: MaterialIconRequest): string {
  return `
    Create a ${YOUR_CUSTOM_STYLE} icon of ${material.name}.
    // Your custom prompt here
  `;
}
```

### Change Icon Size

Edit `utils/materialIconGenerator.ts`:

```typescript
const ICON_SIZE = 256; // Change from 512 to smaller size
```

### Change Generation Delay

Edit `hooks/useMaterialIcons.ts`:

```typescript
// Change from 2000 to faster/slower:
setTimeout(() => {
  generateMissing(missingMaterials);
}, 1000); // 1 second instead of 2
```

## 📚 More Info

- **Full Setup Guide**: See `ICON_GENERATION_SETUP.md`
- **Architecture**: See `ICON_SYSTEM_ARCHITECTURE.md`
- **Complete Summary**: See `MATERIAL_ICONS_SUMMARY.md`

## 💬 Need Help?

1. Check browser console for errors
2. Review the detailed setup docs
3. Test backend API independently
4. Verify environment variables are set

---

**Ready to go?** Just update your backend and start the app. Icons will generate automatically! 🎉
