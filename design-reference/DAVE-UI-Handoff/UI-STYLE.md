# DAVE visual styling reference

This is a presentation reference. It contains no screen behaviour specification.

## Source files

The reference uses three CSS files, in this order: `style.css`, `stages.css`, then `prototype-content.css`. Later declarations override earlier ones. Use the resulting appearance as a reference; scope adapted styles to the existing application's components instead of blindly installing the global selectors.

## Fixed brand assets

- `visual-reference/assets/dave-logo.jpeg`: unchanged supplied logo image, including its original background and surrounding space.
- `visual-reference/assets/palette-reference.jpeg`: unchanged supplied five-colour brand reference.

No vector logo was supplied. Local DM Sans font files and their licence are included in `visual-reference/assets/fonts/`. The logo lettering is part of the image; it must not be recreated as ordinary text. The current mockup displays the image with `object-fit: contain`.

## Colour values used in the approved mockup

These values were sampled from the supplied JPEG palette and then used in the preview. They document the rendered mockup; they do not redefine the original brand palette. If original master colour codes are available in the working project, retain those as authoritative rather than treating JPEG sampling as a new palette.

| CSS token | Value | Visual usage in this reference |
| --- | --- | --- |
| `--ink` | `#141414` | Outer background, text, dark controls |
| `--cream` | `#FFF3E7` | Workspace and control surfaces |
| `--pink` | `#E85599` | Active stage marker, selected position control, accent |
| `--blue` | `#3AC7FF` | Category and branch accents |
| `--purple` | `#A609F0` | Relation and question accents |
| `--lime` | `#BDF522` | Category and empty-state accent |
| `--orange` | `#FE8616` | Potential-tension accent |
| `--muted` | `#756F69` | Secondary text |
| `--line` | `rgba(20,20,20,.14)` | Fine borders and separators |

Muted text, border opacity and translucent surfaces are interface treatments. Semantic colour assignments in the mockup are illustrative; do not change the working application's category identity, statuses or logic to enforce these assignments.

## Typography

- Interface font: **DM Sans**, with Arial / sans-serif fallback. The CSS loads local variable font files, preserving weights 400–700 including intermediate weights 450, 550 and 650.
- Body: 14px base; actual card copy typically 11–13px with 1.6–1.8 line-height.
- Project title: 25px, weight 500, −0.8px letter-spacing.
- Main panel heading: 28px, weight 500, −1px letter-spacing; some secondary panels use 22–26px.
- Research card title: 21px, weight 550, −0.5px letter-spacing.
- Eyebrows: 9–10px, uppercase, approximately 1–1.7px letter-spacing.
- Compact map text is smaller in the reference because it represents a canvas. Maintain the working application's current zoom and accessibility behaviour.

## Composition and surfaces

- Desktop outer horizontal margin: 28px. Header height: 126px. Main cream workspace corner radius: 25px.
- Desktop stage bar: 91px high; fine bottom border. Active stage has a pink circular number badge and bold dark label.
- Research split: approximately 64% research panel / 36% map. A 1px separator and small circular expansion control visually define the split.
- Dimensions panel: 360px wide in this reference, with approximately 22–25px inner horizontal padding. Adapt to available space without changing functionality.
- General panel padding: 28–34px. Research card gap: 14px.
- Research card radius: 18px; 1px fine border; translucent light surface; padding about 21px × 24px.
- Map node radius: 13px; 1px dark border; small dark offset shadow.
- Relation cards: cream fill, 4px accent top border, subtle offset shadow. Claims sit within rounded category groups with colour accents.
- Canvas dotted texture: radial dots, approximately 18px apart. Connection strokes are fine; potential tensions use dashed strokes.
- Buttons are typically pill-shaped. Small secondary tags and position controls use softer rectangular corners.
- Dialog: cream surface, 22px radius, dark border, 38px padding, dimmed background.

These dimensions describe the approved desktop reference. They are not fixed viewport rules for the working application.

## Responsive reference

The reference has compact treatments at 1100px and 760px: smaller outer spacing, simplified header, scrollable navigation, stacked content where appropriate. The handoff screenshots primarily verify desktop appearance. Preserve all existing functionality and responsive behaviour when adapting these treatments.

## Visual review

Compare typography, brand asset fidelity, panel proportions, spacing, surface colours, borders, selected-state appearance and readability. Use existing real project data, including long labels, to check wrapping and overflow. Treat the static screenshots as presentation references, not requirements for particular content, counts or selected states.
