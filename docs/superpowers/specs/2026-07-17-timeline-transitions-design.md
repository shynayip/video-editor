# Timeline Transitions and Contextual Trim Handles

## Goal

Make transitions easy to apply directly between adjacent timeline clips while reducing visual clutter from always-visible trim controls.

## Interaction Design

- Show a small transition node at the boundary between two adjacent video clips on the same track.
- Clicking the node opens transition controls in the existing Animations details panel.
- The panel offers None, Fade, Dissolve, Slide, and Zoom choices plus a transition-duration control.
- Selecting a transition applies it across the outgoing end of the first clip and the incoming start of the second clip.
- Clicking outside the controls or pressing Escape clears the selected transition boundary.
- A transition node is not shown at a track's beginning, end, or across a timeline gap.
- Trim handles appear only on the currently selected clip. Unselected clips do not reserve visible space for trim handles.

## Data Model

Store transition data on the incoming clip and identify the preceding adjacent clip when rendering. The transition record contains its preset and duration in frames. `none` removes the transition. Duration is clamped so it cannot exceed the available edge duration of either clip.

## Components and State

- The timeline derives adjacent clip boundaries after clips are ordered by timeline position.
- A boundary node owns only presentation and selection; it delegates updates through the existing undoable editor-state path.
- The controls use the existing Animations panel and animation option styling.
- Preview rendering reads the incoming clip's transition and blends the two adjacent clips only during the configured boundary window.
- Selecting a clip closes the transition controls; selecting a transition boundary clears clip trim focus.

## Error and Edge Handling

- Ignore transition updates if either clip has been deleted or moved away from the boundary.
- Re-clamp transition duration after trimming, splitting, speed changes, or moving either clip.
- Split clips begin without an automatic transition.
- Undo and redo restore transition selection and duration through the existing history mechanism.

## Verification

- Logic tests cover adjacency detection, duration clamping, removing a transition, and boundaries with gaps.
- UI tests cover node visibility, Animations panel controls, dismissal, and selected-only trim handles.
- Preview tests verify the transition is applied only within its boundary window.
- TypeScript, the editor test suites, and browser interaction checks must pass.
