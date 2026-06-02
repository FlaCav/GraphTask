---
name: Luminous Task Flow
colors:
  surface: '#f3fbf6'
  surface-dim: '#d4dcd7'
  surface-bright: '#f3fbf6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#edf6f1'
  surface-container: '#e7f0eb'
  surface-container-high: '#e2eae5'
  surface-container-highest: '#dce4e0'
  on-surface: '#151d1a'
  on-surface-variant: '#3b4a45'
  inverse-surface: '#2a322f'
  inverse-on-surface: '#eaf3ee'
  outline: '#6b7a74'
  outline-variant: '#bacac3'
  surface-tint: '#006b57'
  primary: '#006b57'
  on-primary: '#ffffff'
  primary-container: '#20dfb9'
  on-primary-container: '#005e4c'
  inverse-primary: '#20dfb9'
  secondary: '#495b9d'
  on-secondary: '#ffffff'
  secondary-container: '#a4b6fe'
  on-secondary-container: '#334586'
  tertiary: '#835500'
  on-tertiary: '#ffffff'
  tertiary-container: '#ffb955'
  on-tertiary-container: '#734a00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#52fcd5'
  primary-fixed-dim: '#20dfb9'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#005141'
  secondary-fixed: '#dce1ff'
  secondary-fixed-dim: '#b6c4ff'
  on-secondary-fixed: '#001550'
  on-secondary-fixed-variant: '#304383'
  tertiary-fixed: '#ffddb5'
  tertiary-fixed-dim: '#ffb955'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#633f00'
  background: '#f3fbf6'
  on-background: '#151d1a'
  surface-variant: '#dce4e0'
  background-warm: '#FDFBF7'
  text-main: '#4A4A4A'
  text-muted: '#B5B5B5'
  blocked-by: '#9CAEF6'
  blocks-danger: '#F69C9C'
  link-teal: '#17A387'
  surface-pure: '#FFFFFF'
typography:
  display-title:
    fontFamily: Quicksand
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
  section-header:
    fontFamily: Quicksand
    fontSize: 18px
    fontWeight: '700'
    lineHeight: '1.4'
  body-main:
    fontFamily: Nunito
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-secondary:
    fontFamily: Nunito
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Quicksand
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
  meta-sm:
    fontFamily: Nunito
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  page-margin: 1.5rem
  section-gap: 2rem
  element-gap: 1rem
  stack-tight: 0.5rem
  drawer-width: 480px
---

## Brand & Style
The brand personality is **warm, approachable, and intellectually organized**. It targets creative professionals and project managers who find traditional task tools too clinical or rigid. The emotional response is one of "calm productivity" and "soft focus."

The design style is a hybrid of **Minimalism** and **Soft-Tactile**. It prioritizes heavy whitespace and a warm cream base to reduce eye strain. Rather than harsh grid lines, it uses subtle tonal shifts and soft-edged containers to define boundaries. The aesthetic draws inspiration from physical organizational tools like high-end stationery and bulletin boards, emphasizing a "tactile" feel without being fully skeuomorphic.

## Colors
The palette is built on a "Warm Cream" foundation (`#FDFBF7`) to create a welcoming, non-institutional atmosphere. 

- **Primary**: A vibrant mint-teal (`#20dfb9`) used sparingly for action highlights and accents.
- **Functional Accents**: We use a specific color-coding system for dependencies: Periwinkle blue (`#9CAEF6`) for upstream/prerequisites and soft coral (`#F69C9C`) for downstream/dependents.
- **Typography**: Avoids pure black. A deep charcoal (`#4A4A4A`) provides high legibility while maintaining the "soft" brand character.
- **Interactions**: Use high-transparency overlays (e.g., `primary/10`) for badges and link backgrounds to maintain the airy, light-filled aesthetic.

## Typography
The system uses a two-font strategy to balance character with readability.
- **Quicksand (Display)**: Used for all headers and labels. Its rounded terminals reinforce the friendly, optimistic brand voice.
- **Nunito (Body)**: Used for all long-form content, inputs, and descriptions. It provides high legibility while sharing the soft, slightly rounded characteristics of the display face.

**Scale Philosophy**: We use a generous scale. Section headers should feel distinct but not aggressive. Meta-text uses a semi-bold weight to ensure accessibility against muted colors.

## Layout & Spacing
The layout follows a **Fluid Content Model** within defined functional containers (like drawers or cards). 

- **Rhythm**: A 4px/8px baseline grid is used. Sections are separated by a standard 32px (`2rem`) gap to create clear mental "breaks" between different types of metadata.
- **Safe Areas**: Use a minimum 32px horizontal padding within containers to maintain an "executive" and spacious feel.
- **Responsibility**: On mobile devices, the side drawer transitions into a full-screen overlay. The 32px side padding should reduce to 16px on screens smaller than 640px.

## Elevation & Depth
Depth is created through **Diffuse Lighting and Tinted Shadows** rather than traditional grey shadows.

- **Floating Layers**: Primary containers (like drawers) use a "Float" shadow: `0 20px 40px rgba(74, 74, 74, 0.08)`. This creates a subtle lift without feeling heavy.
- **Soft Inset**: Text areas and input fields use a `shadow-inner` or a subtle background tint (`#FDFBF7`) to create "wells" in the UI, indicating interactivity.
- **Backdrop**: Use a subtle 2px backdrop blur with a low-opacity charcoal overlay (`#4A4A4A/5`) to focus attention on the active layer.
- **Borders**: Outlines are treated as "ghost borders"—very low contrast (e.g., `white/50` or `gray-100`)—intended to be felt rather than seen.

## Shapes
The shape language is dominated by **Exaggerated Rounding**.
- **Base Units**: Standard interactive blocks use a `16px` (rounded-block) radius.
- **Large Containers**: Drawers and large modals use a `24px` radius.
- **Interactive Pills**: All buttons and status chips are fully rounded (`9999px`) to emphasize the "squishy" and friendly nature of the UI.
- **Avoidance**: Pure 90-degree corners are strictly forbidden.

## Components
- **Buttons**: Use a pill-shaped, high-padding design. Primary actions utilize `primary/10` background with a slightly darker text variant for contrast.
- **Dependency Chips**: Large, full-width buttons with a 12px radius. They should feature a circular icon leading the text and a chevron indicating "drill-down" capability. Hover states should include a subtle `translate-y-[-2px]` and a slight shadow increase.
- **Input Fields**: Borderless with a warm background tint. The focus state should never use a heavy outline; instead, use a soft `primary/20` ring.
- **Resource Links**: Pill-shaped with leading icons. Use a subtle border (`gray-100`) for secondary resources and a tinted background for primary resources (e.g., Figma links).
- **Dividers**: Extremely light horizontal rules (`gray-50` or `gray-100`). If sections are clearly defined by spacing, dividers can be omitted entirely.