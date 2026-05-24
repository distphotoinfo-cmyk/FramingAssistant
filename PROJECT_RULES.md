# Framing Assistant - Development Stability Protocol

## Current Project Phase

Framing Assistant is in a launch-readiness and stability-first phase.

The app now contains:
- saved framed artwork
- persistent artwork image storage
- project folders
- saved wall layouts/mockups
- Room View artwork placement and editing
- My Wall photo calibration
- preset room metadata
- framing, mat, mount board, and sizing calculations
- export/rendering behavior
- AI Wall Enhancement client and backend pathways

Development must prioritize:
1. Stability
2. Predictability
3. User data protection
4. Isolated changes
5. Reproducible testing
6. Regression prevention
7. Launch readiness

NOT rapid architecture churn.

AI model testing, CloudKit sync, and backup mirroring are later-stage work. They should be treated as planning or staging items unless explicitly promoted to the current priority.

---

# 1. Protected Systems

The following systems are high risk and must not be modified casually.

## Protected Systems

- saved artwork persistence
- artwork image storage and persistent image URI handling
- project folders and saved library organization
- saved wall layouts/mockups
- Room View gesture, selection, hit testing, and dragging
- Room View duplicate, replace, edit, delete, and placement controls
- smart guides and snapping behavior
- My Wall calibration, ruler placement, and measurement input
- My Wall photo upload/change flow
- export and final render generation
- AI backend/client pathway
- AI backend environment and API-key safety
- framing, mat, reveal, mount board, and size calculations
- frame profile/material calculations
- room metadata and preset scene registration
- preset room placement regions and lighting metadata
- saved artwork and wall layout thumbnails

These systems may only be modified when:
- the prompt explicitly names the protected system, or
- there is a confirmed reproducible bug in that system, or
- the user gives explicit approval after the risk is identified.

If a protected system must be touched unexpectedly:

STOP and explain:
- why it must be touched
- what files are involved
- what user data or workflows could be affected
- how the change will be verified
- what rollback path exists

Do not continue silently.

---

# 2. Safer Development Areas

Prefer lower-risk, view-level work between stabilization passes.

## Safer Feature Areas

- copy and label polish
- modal layout refinements
- card action rows
- spacing and visual hierarchy
- non-persistent display sorting
- icon/button presentation
- onboarding/help text
- empty states
- small UI affordances
- read-only previews
- diagnostics and logging
- documentation
- planning notes

Even in safer areas:
- do not broaden scope
- do not alter persistence
- do not change calculations
- do not change Room View gestures
- do not touch AI backend behavior unless requested

---

# 3. No Unrelated Changes Rule

When implementing a fix or feature:

- Only modify files directly related to the requested task.
- Do not perform opportunistic cleanup.
- Do not rename or restructure unrelated code.
- Do not silently broaden implementation scope.
- Do not rewrite architecture during a feature pass.
- Do not change calculations unless the prompt explicitly asks for calculation work.
- Do not alter saved data formats unless the prompt explicitly asks for persistence changes.

If unrelated issues are discovered:

- document them
- explain them
- do not silently fix them during another task

---

# 4. One System Per Pass

Implementation passes should target one subsystem at a time whenever possible.

Avoid combining:

- saved artwork persistence changes
- Room View gesture changes
- smart guide/snapping changes
- My Wall calibration changes
- export/rendering changes
- AI backend changes
- project folder/library changes
- room metadata changes
- calculation changes
- broad layout redesigns

Smaller isolated passes are preferred over broad rewrites.

If a prompt asks for multiple systems at once, split the work into clear phases and report the boundaries.

---

# 5. Codex Prompt Expectations

Every implementation prompt should ideally include:

## Required Sections

- Goal
- Allowed scope
- Protected scope
- What must NOT change
- Verification requirements
- Device/screen scope if layout-related
- Diagnostics requirements if applicable
- Expected final report

Codex should NOT:

- clean up unrelated code
- refactor architecture opportunistically
- modify protected systems unless explicitly approved
- silently modify shared infrastructure
- change schemas casually
- rewrite Room View gestures without a targeted prompt
- alter saved artwork image handling during unrelated work
- change AI backend/client behavior during unrelated UI work
- change preset room metadata during unrelated UI work

If required context is missing and guessing would risk a protected system, Codex should stop and ask for clarification.

---

# 6. Mandatory Verification Reporting

Every implementation response should include:

## Required Reporting

- files changed
- systems touched
- systems explicitly not touched
- verification performed
- lint result
- typecheck result
- remaining risks
- what still requires simulator or real-device validation

If a command could not be run, report that clearly.

For UI-only changes, still report whether protected persistence, calculations, AI, export, and Room View gestures were untouched.

---

# 7. STOP Conditions

Stop before implementation if a requested fix unexpectedly requires:

- saved artwork schema changes
- artwork image storage changes
- Room View gesture rewrite
- hit-testing architecture changes outside the requested scope
- smart snapping behavior changes outside the requested scope
- framing/mat sizing calculation changes
- My Wall calibration math changes
- export/rendering pipeline changes
- AI backend contract changes
- API key handling changes
- room metadata migration
- CloudKit, backup, or sync implementation

When stopping, explain:

- why the protected system is involved
- what risk exists
- what files may be affected
- what validation would be required
- whether a smaller safe alternative exists

---

# 8. Build and TestFlight Discipline

TestFlight builds should be treated as staging builds, not casual checkpoints.

## Before Any TestFlight Upload

Run a local sanity pass:

- changed screen opens
- changed workflow completes
- no obvious crashes
- no unexpected modified files
- lint passes
- typecheck passes
- changed files reviewed
- protected systems reviewed for accidental edits

## Internal TestFlight Validation

Before asking beta users to test:

- install personally on iPhone
- install personally on iPad
- test only the workflows touched by the build
- test one or two adjacent high-risk workflows if nearby systems were touched
- confirm saved artwork still reopens with images
- confirm Room View selection/dragging still works if Room View was touched
- confirm My Wall upload/calibration still works if My Wall was touched

## Beta Tester Release

Only after internal validation:

- tell testers what changed
- give targeted test goals
- do not ask for broad unfocused testing
- note any known risks

---

# 9. Regression Prevention Checklist

Use the relevant parts of this checklist before considering a pass complete.

## Saved Artwork

- save a new framed artwork
- reopen it from project folder
- confirm uploaded image appears
- confirm crop/fit persists
- confirm frame/mat settings persist
- duplicate saved artwork if duplication was touched
- edit saved artwork without accidental overwrite

## Project Folders

- create a folder
- save artwork into a folder
- save a wall layout into a folder
- switch between Artwork and Wall Layouts
- confirm cards and thumbnails render
- confirm delete prompts are intentional

## Room View

- place artwork on a preset wall
- place multiple artworks
- select each artwork precisely
- tap background to deselect
- drag artwork smoothly
- duplicate selected artwork
- replace artwork
- edit selected artwork
- delete selected artwork
- verify grid snapping if snapping was touched
- verify smart guides if guides were touched

## My Wall

- upload wall photo
- take or change photo if that flow was touched
- enable ruler
- verify known length input is visible
- confirm calibration persists
- place artwork after calibration
- verify AI enhancement control only appears when configured and enabled

## Preset Rooms

- open preset room picker
- select a preset room
- place artwork naturally in placement region
- verify room metadata was not accidentally changed

## Export and Rendering

- preview final framed artwork
- render/export if export was touched
- verify artwork image appears
- verify mat/frame proportions are correct

## AI Wall Enhancement

- confirm no API key is in mobile code
- confirm backend URL gating works
- confirm error handling is friendly
- confirm original wall image is preserved
- confirm Original/Enhanced toggle works if touched

---

# 10. Current Priority

Current priority:

- launch readiness
- stability
- saved artwork reliability
- Room View reliability
- project/library usability
- My Wall reliability
- export confidence

Later priorities:

- AI model testing and model comparison
- production AI backend hardening
- CloudKit sync
- backup mirroring
- subscription/entitlement enforcement

Do not implement later-priority systems unless the user explicitly promotes them into the current task.

