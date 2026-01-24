# PWA Icons Required

This folder should contain your app icons in the following sizes:

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

## How to Generate Icons:

1. **Using Online Tools:**
   - Visit https://realfavicongenerator.net/
   - Or https://www.pwabuilder.com/imageGenerator
   - Upload your logo/icon (recommended: 512x512 PNG)
   - Download all sizes

2. **Using Design Tools:**
   - Create a square icon (512x512px) in Figma/Photoshop
   - Export in all required sizes

3. **Using Command Line (ImageMagick):**
   ```bash
   magick convert your-icon.png -resize 72x72 icon-72x72.png
   magick convert your-icon.png -resize 96x96 icon-96x96.png
   # ... repeat for all sizes
   ```

## Icon Guidelines:
- Use PNG format
- Square aspect ratio
- Simple, recognizable design
- Works well at small sizes
- Appropriate padding/margins
