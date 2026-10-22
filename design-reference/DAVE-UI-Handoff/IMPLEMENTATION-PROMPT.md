# Apply DAVE's approved UI design only

Apply the visual design in this package to our existing, fully working DAVE prototype. This is a presentation-only change.

Use the existing working application as the sole authority for functionality, data and behaviour. Use the supplied screenshots, static HTML, CSS and brand assets as the authority for visual appearance.

Preserve the existing backend, AI prompts, model calls, analysis and generation logic, data models, storage, validation, application state, branching, tuning semantics and workflows. Preserve existing handlers, API contracts and existing tests. Do not replace working components or logic with a mock implementation.

Adapt the reference's typography, palette, spacing, panel composition, cards, borders, rounded corners and control styling to the current application architecture. Keep the original logo and colour palette unchanged. Read UI-STYLE.md and inspect the static visual references.

All sample research, excerpts, names, numbers, dimension choices and generated questions in this package are visual placeholders. Keep the working application's real content and outputs. Do not copy sample values into data, prompts, generation logic or initial state.

The HTML and CSS describe appearance, not behaviour. Fixed node positions, SVG paths, disabled states, selected states, screen visibility and overflow in the samples must not redefine the working application's graph layout, interactions or business rules. Retain its existing map engine, zoom, pan, dragging, connections and selection behaviour while styling its rendered elements.

Preserve every existing action, including actions absent from these references. Style those actions consistently and keep them accessible. Do not add, remove or change features to make the application match a static picture. Retain existing user-facing terminology where it has functional meaning.

Do not add the mockup's design-review footer, preview state switches, demo notices or simulated data. Do not import or recreate the mockup's simulated application logic; no demo JavaScript is supplied.

Inspect the existing UI first, identify the components to restyle, and implement through presentation changes in that codebase. If a visual detail would require a behavioural change, retain the working behaviour and flag the visual limitation instead of changing the logic. Routine styling choices within this scope can proceed.

Verify the restyled screens against the supplied desktop screenshots. Run the project's existing relevant checks and smoke-test its existing research, relationships, dimensions and exploration behaviour. Report the visual changes and any visual compromises. Do not expand this task into a logic refactor or a workflow redesign.
