# New Themes Added

Two new retro themes have been added to the Claude Jobs interface:

## IBM Theme
Classic IBM PC monochrome green screen aesthetic.

**Features:**
- Pure black background (#000000)
- Bright green phosphor text (#00ff00)
- Authentic CRT terminal look
- Perfect for that vintage mainframe feel

**Color Palette:**
- Primary text: `#00ff00` (bright green)
- Secondary text: `#00cc00` (medium green)
- Tertiary text: `#008800` (dark green)
- Background: `#000000` (black)
- Secondary background: `#0a0a0a` (near-black)

## Windows 95 Theme
Nostalgic Windows 95 interface with classic gray UI elements.

**Features:**
- Light gray background (#c0c0c0) - the iconic Win95 desktop color
- Black text on light backgrounds
- Authentic Win95 button styling with 3D beveled edges
- Classic inset/outset border effects on inputs and dropdowns
- Navy blue accent color (#000080)

**Color Palette:**
- Primary text: `#000000` (black)
- Secondary text: `#000080` (navy blue)
- Tertiary text: `#808080` (gray)
- Background: `#c0c0c0` (Win95 gray)
- Secondary background: `#ffffff` (white)
- Accent: `#000080` (navy blue)

**Special Styling:**
- Buttons use classic Win95 3D beveled borders
- Inputs have authentic inset appearance
- Select dropdowns match Windows 95 combo boxes
- No transform animations on button press (stays true to original)

## Usage

Select either theme from the theme picker (🎨 button) in the top-right corner of the interface.

The themes are now part of the theme array:
```typescript
["dark", "light", "matrix", "cyberpunk", "amber", "ocean", "ibm", "win95"]
```

## Files Modified

1. **app/src/app/globals.css** - Added theme CSS variables and Win95-specific UI styling
2. **app/src/app/page.tsx** - Updated theme type and theme selector array
