# Material Icons - Quick Reference Card

## 📋 TL;DR

1. **Update backend** to support image generation
2. Run `npm run generate-icons` (once, ~$8, ~10 min)
3. Commit `/public/icons/` to repo
4. Deploy - icons work for all users forever

---

## 🚀 One-Time Setup

```bash
# 1. Update your backend (see QUICK_START_ICONS.md)

# 2. Install dependencies
npm install ts-node --save-dev

# 3. Generate all icons
npm run generate-icons

# 4. Commit & deploy
git add public/icons
git commit -m "Add material icons"
git push
```

**That's it!** ✅

---

## 💡 Usage in Components

```tsx
import { MaterialIconDisplay } from './components/MaterialIconDisplay';

// Single material with icon
<MaterialIconDisplay
  material={material}
  size={64}
  showName={true}
/>

// Grid of materials
import { MaterialGrid } from './components/MaterialIconDisplay';

<MaterialGrid
  materials={MATERIAL_PALETTE}
  onSelectMaterial={(m) => console.log(m)}
  selectedMaterialId={selectedId}
  iconSize={80}
/>
```

---

## 📁 File Structure

```
/public/icons/
  ├── steel-frame.png
  ├── glulam-structure.png
  ├── concrete-frame.png
  ├── ... (200+ icons)
  └── manifest.json
```

---

## 💰 Cost

| Action | Cost |
|--------|------|
| Generate all icons (once) | ~$8 |
| Serve to users | $0 |
| Add 1 new material | $0.04 |
| Regenerate all | ~$8 |

---

## 🔄 Adding New Materials

```typescript
// 1. Add to constants.ts
export const MATERIAL_PALETTE: MaterialOption[] = [
  // ...existing materials
  {
    id: 'new-material',
    name: 'New Awesome Material',
    description: 'A new material description',
    finish: 'Polished',
    tone: '#abc123',
    keywords: ['new', 'awesome'],
    category: 'finish',
    carbonIntensity: 'low'
  }
];

// 2. Generate its icon
npm run generate-icons  // Only generates missing icons

// 3. Commit
git add public/icons/new-material.png
git commit -m "Add new-material icon"
```

---

## 🛠️ Regenerating Icons

```bash
# Regenerate ALL icons (new style, better quality, etc.)
rm -rf public/icons
npm run generate-icons

# Regenerate ONE icon
rm public/icons/steel-frame.png
npm run generate-icons
```

---

## 🔍 Checking Icon Status

```bash
# Count generated icons
ls public/icons/*.png | wc -l

# Check manifest
cat public/icons/manifest.json

# Total size
du -sh public/icons
```

---

## ⚡ Performance

- **Icons**: Lazy loaded (as needed)
- **Browser**: Caches automatically
- **First visit**: ~10-20MB download
- **Return visits**: Instant (cached)

---

## 🐛 Troubleshooting

### Icons not showing?

1. Check file exists: `ls public/icons/steel-frame.png`
2. Check browser network tab for 404s
3. Verify URL is `/icons/${material.id}.png`

### Generation failed?

1. Check backend supports `mode: "image"`
2. Verify `GEMINI_API_KEY` is set in Function App settings (server-side only)
3. Check console for errors
4. Try generating one icon manually

### Fallback not working?

Icons automatically fall back to color swatch if:
- File doesn't exist
- Network error
- Image fails to load

---

## 📚 Full Documentation

- [PRODUCTION_READY_SUMMARY.md](PRODUCTION_READY_SUMMARY.md) - Complete overview
- [QUICK_START_ICONS.md](QUICK_START_ICONS.md) - 5-minute setup
- [ICON_STORAGE_PRODUCTION.md](ICON_STORAGE_PRODUCTION.md) - Advanced storage options
- [ICON_SYSTEM_ARCHITECTURE.md](ICON_SYSTEM_ARCHITECTURE.md) - Technical architecture

---

## ✅ Production Checklist

- [ ] Backend supports image generation
- [ ] Icons generated (`npm run generate-icons`)
- [ ] `/public/icons/` contains PNG files
- [ ] Icons display correctly locally
- [ ] Changes committed to repo
- [ ] Deployed to production
- [ ] Icons load in production
- [ ] Fallbacks work for missing icons

---

**Questions?** Check [PRODUCTION_READY_SUMMARY.md](PRODUCTION_READY_SUMMARY.md)
