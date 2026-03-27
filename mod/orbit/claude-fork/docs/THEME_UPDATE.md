# Theme System Update

## Changes Made

### 1. White Text as Primary Color
- Changed primary text color from green (`#33ff33`) to white (`#ffffff`)
- Updated all text elements to use CSS variables instead of hardcoded colors
- Improved readability with proper contrast

### 2. Multiple Theme Support
Added 6 themes:

#### **Dark** (Default)
- Background: `#0a0a0a` / `#080808`
- Text: White (`#ffffff`)
- Accent: Green (`#33ff33`)

#### **Light**
- Background: `#f5f5f0` / `#ffffff`
- Text: Dark (`#1a1a1a`)
- Accent: Dark Green (`#2d5016`)

#### **Matrix**
- Background: Black (`#000000`)
- Text: Matrix Green (`#00ff41`)
- Accent: Matrix Green
- Classic terminal aesthetic

#### **Cyberpunk**
- Background: Deep Purple (`#0d0221`)
- Text: White with neon accents
- Accent: Magenta (`#ff00ff`)
- Neon cyberpunk vibes

#### **Amber**
- Background: Dark Brown (`#1a0f00`)
- Text: Warm Amber (`#ffe6cc`)
- Accent: Amber (`#ffb000`)
- Classic terminal amber glow

#### **Ocean**
- Background: Deep Blue (`#001a2e`)
- Text: Light Blue (`#e6f7ff`)
- Accent: Cyan (`#00aaff`)
- Cool oceanic theme

### 3. CSS Variables
All colors now use CSS variables for easy theming:
- `--text-primary`: Main text color
- `--text-secondary`: Secondary text
- `--text-tertiary`: Tertiary/muted text
- `--accent-color`: Theme accent color
- `--bg-primary`: Main background
- `--bg-secondary`: Secondary background
- `--crt-green`, `--crt-amber`, `--crt-blue`, `--crt-red`: Status colors

### 4. Theme Selector
- Added theme dropdown in header
- Themes persist in localStorage
- Smooth transitions between themes
- Easy to add more themes

### 5. Updated Components
- Input fields (text, password, textarea)
- Select dropdowns
- Scrollbars
- All text elements
- Status indicators
- Buttons
- Borders

## Usage

Click the theme button (🎨) in the header to switch between themes. The selected theme is saved and will persist across sessions.

## Adding New Themes

To add a new theme, add a new section in `globals.css`:

```css
:root[data-theme="mytheme"] {
  --crt-green: #color;
  --crt-amber: #color;
  --crt-blue: #color;
  --crt-red: #color;
  --crt-dark: #color;
  --text-primary: #color;
  --text-secondary: #color;
  --text-tertiary: #color;
  --accent-color: #color;
  --bg-primary: #color;
  --bg-secondary: #color;
}
```

Then add "mytheme" to the theme selector array in `page.tsx`.
