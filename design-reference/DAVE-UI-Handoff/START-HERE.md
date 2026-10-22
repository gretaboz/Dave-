# DAVE — UI-only handoff

Approved visual reference · 22 October 2026

This package specifies appearance only. The working prototype on the other computer remains the sole authority for behaviour, functionality and data.

## Use on the other computer

1. Extract the entire ZIP into a reference folder beside the existing project.
2. Open `index.html` to browse the screen references and screenshots.
3. Give the coding chat `IMPLEMENTATION-PROMPT.md`, together with access to this folder and the existing project.

## Contents

- `screenshots/`: nine views captured from the approved mockup at a 1440 × 1000 desktop viewport. Full-page images may be taller where the layout overflows the viewport.
- `visual-reference/`: static HTML snapshots, the three CSS files used by the mockup, and unchanged supplied brand images. No application JavaScript or backend is included.
- `UI-STYLE.md`: presentation values and visual references to consult when adapting existing components.
- `IMPLEMENTATION-PROMPT.md`: the UI-only implementation instruction to give the coding chat.

The HTML files are appearance samples, not a second application. Buttons and navigation in those files do not run the demo. Open each screen from the gallery. Native HTML controls may still respond visually.

DM Sans is loaded locally from `visual-reference/assets/fonts/`, including its font licence. No Google Fonts connection is required. The PNG references preserve the captured font appearance.

## What these references do not specify

There is no workflow specification in this package. Example project names, research text, source names, category counts, selected dimensions, branches and questions are display samples. They do not define real research, business rules, prompts, validation, generation or persistence.

The mockup's review footer and its Starting screen / Material analysed / Expanded map switches are presentation aids. They are not controls to add to the working product. Likewise, local-preview notices and demo-specific text are not product copy requirements.

Existing features absent from these references must stay available and receive matching styling. The screenshots are not an exhaustive feature list.

The original logo and palette are fixed. Do not redesign, trace, recolour or regenerate them.
