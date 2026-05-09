# DinoLabs

A complete creative studio available right in your broawser. DinoLabs is a single web app that pulls together the file editors, productivity utilities, and developer tooling that normally live across a dozen separate desktop apps, and runs them all client-side in a unified workstation. 

Hosted at **[DinoLabs](https://dino-labs.vercel.app/login)**. Account creation, sessions, and team management are handled through Dino Auth (see below).

**Stack:** React + Vite on the frontend, Node.js + Express + PostgreSQL on the backend. File System Access API + IndexedDB for persistence.

This is a frontend product. The backend is kept intentionally small. Calendar CRUD and a PostgreSQL connection proxy are the only two route groups, plus the Dino Auth pass-through for everything user/team-related. Most "creative studio" platforms in this category are thin clients on top of a heavy server. DinoLabs is the inverse.

---

## Screenshots

| Code Editor | Plugins Hub | Tabular Editor |
|:---:|:---:|:---:|
| ![Code Editor](screenshots/codeeditor.png) | ![Plugins Hub](screenshots/toolkit.png) | ![Tabular Editor](screenshots/tabulareditor.png) |

| Image Editor | Calendar | Database Explorer |
|:---:|:---:|:---:|
| ![Image Editor](screenshots/imageeditor.png) | ![Calendar](screenshots/calendar.png) | ![Database Explorer](screenshots/database.png) |

---

## The pages

DinoLabs groups its pages into three categories: **Workstation** (account, productivity, and diagnostics surfaces), **Editors** (the seven file-type editors plus the PDF viewer), and **Toolkit** (the ten plugin utilities organized into Math/Computation, Design/Media, and Reference/Utility).

### Workstation

#### Calendar
The calendar includes month, week, and day views, with 64-pixel-per-hour time slots and support for events that continue across multiple days. Each day that is touched by a multi-day event gets its own block, with the start and end of the event clamped to midnight on any days that are entirely covered by the event.  Block geometry runs through `getEventPosition`, which classifies each render against `isStartDay`, `isEndDay`, and `isMiddleDay` and produces top/height in pixels.

A custom `CustomDateTimePicker` component handles datetime input rather than the native browser control. It embeds an inline mini-calendar with month navigation, a day grid, and three selects (12-hour hour, minute, AM/PM), all driven through regex-parsing of a timezone-formatted display string so the picker stays consistent with `userTimezone`.

Timezone handling is layered: the initial state default is `"America/New_York"`, the first fetch attempts to pull the user's timezone from the backend's `/user-info` endpoint, and on failure or missing field it falls back to `Intl.DateTimeFormat().resolvedOptions().timeZone`. Display strings (event time labels, formatted dates) all run through `formatTimeInTimezone`/`formatDate` which respect `userTimezone`. Note that event block positioning currently reads from the browser's local timezone via `Date.getHours()`/`getMinutes()` rather than `userTimezone`, so labels and block tops will diverge for users whose browser timezone differs from their configured `userTimezone`.

Event CRUD covers create, read, update, delete, and duplicate, all routed through the `/calendar-events` endpoint group on the backend. Seven color-coded event types live in the `eventTypes` table: event, meeting, reminder, deadline, personal, review, presentation. Seven reminder options: At Time Of Event, 5min, 15min, 30min, 1h, 1d, 1w before.

A current-time indicator renders as a horizontal line inside the matching hour slot on today's column, with hour-precision (no sub-hour positioning). The indicator updates every 60 seconds via a `setInterval`. It does not auto-scroll into view, so the user has to scroll manually to find it on long days.

A long-event guard prompts a confirmation dialog when an event spans more than 7 days, asking the user to confirm before save. JSON export writes the current event array (with parsed Date objects) to a downloaded file via Blob URL. Click-outside dismisses the event modal, with an explicit exception for the alert-dialog overlay so confirmations don't accidentally close the modal underneath them.

#### Database
A full PostgreSQL client running in the browser. Connection management supports both parameter-based config (host, port, database, user, password, SSL mode) and connection-URL parsing (a `^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)$` regex extracts the components), with save, load, delete, test, and connect operations. Two execution paths exist: **saved connections**, keyed by `connectionID` against the backend's encrypted credential store, and **direct connections**, where the connection params are kept ephemerally on the client as `connectionConfig` and sent fresh with each request. The `getConnectionPayload()` helper switches between the two transparently for downstream calls.

Schema browser groups tables by schema name with search filtering across `name` and `schema` fields. The `expandedSchemas` map defaults `public` to expanded and other schemas to collapsed. Clicking any table opens a tabbed detail view with a schema panel (columns, types, constraints, indexes), a paginated sortable data viewer, and table-level statistics (row count, table size, index size, total size).

The query editor is a custom component (`SqlEditor`) with line numbers, PL/pgSQL block-aware code folding, Tab indent handling (inserts two spaces), and Ctrl/Cmd+Enter execution. Folding recognizes a broader set of block openers than just BEGIN/END: `BEGIN`, `CASE`, `CREATE FUNCTION/PROCEDURE/TRIGGER`, `DO`, `LOOP`, and `IF...THEN`, paired with `END`, `END CASE`, `END IF`, `END LOOP`, and `$$;?` as closers, all matched via regex against per-line text. Folds are per-edit-session: any character edit while folds are collapsed clears them all (`setCollapsedLines(new Set())` runs in the textarea's `onChange` handler), so folds don't survive typing. Click-to-toggle on the gutter chevron expands or collapses an individual block.

Query results render with execution timing (computed client-side from `Date.now()` deltas around the fetch), CSV export (with JSON-stringified cells for safe quoting), JSON copy-to-clipboard, and a 50-entry rolling in-memory query history (`prev.slice(0, 49)`). The history clears on page reload. DDL statements (`CREATE`, `DROP`, `ALTER`) auto-refresh the schema browser so newly-created tables appear without a manual reload. Column sorting in the data viewer is server-side: clicking a header refetches the page with `sortColumn` and `sortDirection` parameters. Pagination defaults to 50 rows per page. All upstream traffic to the customer's database goes through the backend's connection-manager worker, which proxies queries and never exposes raw credentials to the client.

#### Monitoring
A client-side diagnostics dashboard built entirely from browser APIs, no server involvement. Ten panels render in a vertical stack:

**Environment** reports platform (from `userAgentData.platform` falling back to `navigator.platform`), language, time zone, secure context (yes/no), and CPU cores. **Display** reports viewport (with DPR), screen resolution, color gamut (sRGB / P3 / Rec2020), dark mode preference, and the UI Load index (with a usage bar). **Network** reports online status, effective connection type, downlink speed in Mbps, and a Ping row that's currently unwired (the `runPing` function exists in the hook but no UI element triggers it, so the value stays at `—`). **Battery** reports level (with a charging indicator icon when applicable) and a charging yes/no, plus a level usage bar. **Performance** reports TTFB, DOM Ready (DCL), Load, FCP, LCP, CLS, and Heap Used; values come from the `performance.getEntriesByType("navigation")` entry plus `PerformanceObserver` for LCP/CLS. **Graphics** reports WebGL 2.0 support (yes/no), WebGPU support (yes/no), and the WebGL renderer string (when `WEBGL_debug_renderer_info` is unmasked). **Media** reports camera count, microphone count, and the AudioContext sample rate. **Storage** reports used and available bytes from `navigator.storage.estimate`, with a usage bar. **Permissions** reports the state of six permissions: geolocation, notifications, camera, microphone, clipboard-read, clipboard-write, and subscribes to `onchange` for live updates. **Location** has a Request Location button that calls `navigator.geolocation.getCurrentPosition` and renders lat/lon (to six decimal places) on success or the error message on failure.

The UI Load index is a passive frame-time monitor: a `requestAnimationFrame` loop measures each frame's delta against the 60fps ideal (`(dt - ideal) / ideal`), accumulates 30 samples, and emits the average as a 0-1 score. No synthetic workload runs.

The Export button serializes a full snapshot to JSON (timestamp, env, display, network, battery, perf, graphics, media, storage, permissions, heap), downloads it as `dinolabs-monitor-{ISO timestamp}.json`, and also copies the same payload to the clipboard.

The hook layer queries more data than it surfaces. Currently computed-but-not-rendered: device memory, user agent string, HDR support, Wi-Fi RTT, First Paint, FID, charging time / discharging time, WebGL vendor / shading language version / antialias, WebGPU adapter features and limits, audio output devices, AudioContext state and base latency. These are kept in state for the JSON export but don't appear in the visible panels, leaving room to surface them in a future settings-driven detail mode.

#### Plugins Hub
The launcher for the ten toolkit pages. Renders as a category-grouped grid (Math/Computation, Design/Media, Reference/Utility) with each plugin tile showing icon, name, short description, and last-used timestamp. Recently-used plugins surface at the top of their category. Search across plugin names, descriptions, and category tags filters the grid in real time.

### Editors

All editors are fully client-side. File loading goes through the File System Access API when available (modern Chromium) with a fallback to traditional file input plus IndexedDB for the working buffer. Saved state survives page reload through the IndexedDB layer.

#### Code Editor
Custom code editor built on top of `DinoLabsMirror`, a from-scratch implementation rather than Monaco or CodeMirror. The architecture is a dual-layer textarea-over-pre approach: the textarea handles input and selection while a synchronized `<pre>` element underneath renders the highlighted token tree, so caret behavior matches native browser controls and copy/paste survives unmangled.

Regex tokenization in `DinoLabsParser.jsx` currently covers 19 grammars across 24 language identifiers: Python, TypeScript, JavaScript (with shared dialects for React, Node, and Express), C, C++, C#, Rust, Swift, PHP, SQL, Bash/Shell, Monkey C, Assembly (x86/x64 with full register and directive coverage), JSON, CSS, HTML, XML, Dockerfile, and Makefile. Each grammar has its own keyword set, operator table, string/comment rules, and where applicable a builtin/type/decorator layer (Python magic methods, TypeScript JSX tags, C# System namespaces, PHP superglobals, Rust lifetimes, x86 register classes, etc.). Per-grammar pattern arrays are paired with a parallel `tokenTypes` map that assigns semantic CSS classes (keyword, function, type, decorator, comment, regex, lifetime, superglobal, etc.) to each capture group so themes can target individual token classes independently.

The tokenizer is built around four layered caches that keep the editor responsive on large files. A **compiled-regex map** holds at most 200 fully-compiled per-language regex objects, joining all per-grammar patterns into one alternation with the global+case-insensitive flags so a single `regex.exec` walk produces every token in a line. A **line-level token cache** keys by `language-lineNumber-fastHash(content)` and holds up to 2000 tokenized lines, where `fastHash` is an inline 32-bit string hash (avoids the cost of building the cache key from full string content). A **full-document token cache** holds up to 1000 entries keyed by `language-fastHash(fullSource)` so re-tokenizing an unchanged file is O(1). A **highlight cache** holds up to 1500 fully-rendered HTML strings keyed by content hash plus search term, case sensitivity, and theme, so a re-render with the same search query and unchanged content reuses the cached HTML. All four caches use FIFO eviction at their size limits.

Two tokenization entry points exist for different rendering paths. `tokenize` walks the entire document and is used for full-file operations like global search and export. `tokenizeViewport` takes a `[startLine, endLine]` range and tokenizes only that window, which is what the editor calls during scroll to keep frame budget bounded regardless of file size. A helper, `getVisibleLineRange`, computes the visible window from container scroll position and line height with a 25-line over-render buffer above and below the viewport so the user can scroll a screen's worth without triggering a re-tokenize. Search-and-highlight runs through `syntaxHighlightViewportOptimized`, which only highlights lines inside the visible range and falls back to plain escaped text outside it.

Search highlighting is range-aware down to the character level. When a search query produces matches that span multiple tokens or partially overlap a single token, the highlighter splits the affected token's HTML so the `searchHighlight` span wraps exactly the matched substring while the surrounding token-class spans wrap the unmatched portions, preserving syntax coloring underneath the highlight. Theme switching (default / dark / light) routes through `themeClass` substitution at HTML build time, so the same tokenized output renders correctly under any theme without re-tokenizing.

Per-language linting scripts live in the `DinoLabsLint/` subdirectory. Each script exports a `lint(source)` function that returns an array of diagnostic objects (line, column, severity, message), and the editor surfaces them as gutter markers and underlines.

Code folding tracks brace pairs, indent levels, and language-specific block markers (BEGIN/END, function declarations, class bodies). Breakpoint markers in the gutter persist across reloads. The minimap renders a downscaled token-color map of the full document with a viewport indicator and click-to-jump navigation. Undo/redo runs through a command queue with grouped operations (typing runs, paste, format) so a single undo reverses the last semantic action rather than the last keystroke.

`DinoLabsParser.jsx` provides the shared tokenization layer that the editor and the Markdown renderer both consume. `DinoLabsMarkdown.jsx` is a separate live-preview pane for `.md` files with rendered headings, code blocks (highlighted via the same parser), tables, and inline math.

The grammar list above reflects current state. Additional language support (Go, Java, Kotlin, Ruby, YAML, Markdown grammar, SCSS, GraphQL, and others) and the associated linting scripts are planned and will land incrementally.

#### Audio Editor
A DAW-lite built on the Web Audio API. The signal chain routes sources through a mixer node into a 3-band parametric EQ (lowshelf at 200Hz, peaking at 1kHz with configurable Q, highshelf at 3kHz), then splits into a parallel vocal path: a band-stop notch at 1200Hz suppresses vocals while a bandpass at 1200Hz with a separate gain node isolates and boosts them, with the Q factor controlling isolation sharpness. Both paths merge into a pre-effect mix that feeds three parallel destinations: the dry signal, an echo path (delay node at 0.3s with a feedback loop through a gain node), and a reverb path (ConvolverNode against a procedurally-generated impulse response built from exponentially-decaying random noise). The three paths merge into a final mix, through a stereo panner, through an ADSR envelope gain node (attack/decay/sustain/release with exponentialRampToValueAtTime scheduling), through a master gain, through an AnalyserNode, and out to the destination.

Seven canvas-rendered visualizations run on `requestAnimationFrame` loops attached to AnalyserNodes at different points in the chain: waveform (block-averaged amplitude with gradient fill and playhead), frequency bars (FFT magnitude with frequency-axis labels derived from sample rate and bin size), scrolling spectrogram (column-at-a-time with three-tier magnitude coloring), oscilloscope (time-domain byte data), left and right channel VU meters (RMS-computed bar meters from a ChannelSplitter), and a phase scope (Lissajous-style L vs R plot). An eighth static canvas renders the ADSR envelope curve from the current attack/decay/sustain/release parameters.

Pitch shift is implemented via playback rate manipulation (`Math.pow(2, pitchShift / 12)` applied to each BufferSource's `playbackRate`), which changes both pitch and duration simultaneously. Fade in/out apply linear gain ramps at the start and end of the buffer during offline rendering.

The timeline auto-assigns clips to tracks: clips that overlap in time get placed on separate track lanes automatically. Clips support drag-to-reorder, split-on-double-click (at the playhead position), delete, duplicate, and left/right edge trim handles that resize the clip's start time or duration on drag. Multi-select mode enables bulk operations (delete, duplicate, group).

OfflineAudioContext-based merge rebuilds the entire signal chain (EQ, vocal isolation, echo, reverb, panner, ADSR envelope, fade in/out) in an offline context, renders to a buffer, and replaces the track list with the merged result. WAV encoder writes 16-bit PCM with correct RIFF/WAVE headers (format chunk, data chunk, interleaved channel samples). Export offers .wav, .mp3, and .flac format options (all currently encode as WAV regardless of selection).

#### Image Editor
Multi-layer compositor for PNG, JPEG, WebP, and SVG inputs (with SVG round-tripping preserved on export when the source was SVG). Three layer types: base (the loaded image, always present), image layers (imported raster images that can be positioned, resized, rotated, zoomed, flipped, and filtered independently), and drawing layers (SVG Bézier strokes stored as individual layers rather than a flat path list, each with its own transform, filter, and opacity stack). Multi-select with Ctrl/Cmd+click works across all layer types, and the sidebar's Layout/Styles/Drawing controls apply to whichever layers are currently selected. Each layer has visibility toggle, lock (prevents interaction), rename, reorder (move up/down in the stack), and delete. Image layers can be imported via a file picker or by dragging and dropping image files onto the canvas, and each one gets its own corner-handle resize interaction.

Drawing uses SVG coordinate math via `createSVGPoint` + `getScreenCTM().inverse()` to convert mouse positions into the viewBox coordinate space, then builds quadratic Bezier curves between sample points for smooth strokes. Each completed stroke becomes a new drawing layer with its own color, stroke width, and the full per-layer property set (rotation, zoom, flip, opacity, hue, saturation, brightness, contrast, blur, grayscale, sepia). A separate Highlight mode uses the same drawing pipeline with a semi-transparent color. Drawing-layer undo/redo pops/pushes entire layers rather than individual path segments.

The crop tool uses canvas-based re-rasterization: an offscreen canvas composites the base image (with its full CSS filter chain applied via `ctx.filter`) plus all visible image layers (with per-layer transforms and filters), then extracts the crop rectangle as a new data URL that replaces the base image. Crop state is pushed to a history stack so crops can be undone back to any previous state. Rotatable crop with four corner rotation handles. Circle crop masks to an ellipse via `ctx.arc` clipping. Crop is disabled when the base layer is rotated or flipped (since the coordinate mapping would produce incorrect results).

Per-layer CSS-filter chain (hue-rotate, saturate, brightness, contrast, blur, drop-shadow, grayscale, sepia, opacity) renders through the canvas filter property on export, producing a single composited output. Export pipeline supports scale multipliers (1x, 2x, 3x), format selection (PNG, JPEG, WebP, plus SVG for SVG source files), and per-layer or all-layers output. The history system generates thumbnails via an offscreen canvas that applies all current transforms, filters, and clipping to produce a preview image for each history entry.

#### Video Editor
Video editor with the same transform/filter/crop/corner-rounding architecture as the Image Editor, extended with timeline, text overlay, frame extraction, and capture features.

Crop uses `canvas.captureStream()` + `MediaRecorder` to re-encode: each frame is drawn via `requestAnimationFrame` from the source video through the crop rect with the full CSS filter chain (hue, saturation, brightness, contrast, blur, grayscale, sepia, opacity) applied via `ctx.filter`, producing a new WebM blob URL that replaces the source. Circle crop clips through `ctx.arc` before drawing. Crop is disabled when the video is rotated or flipped. A crop history stack supports multi-level undo back to the original source.

Text overlays are time-ranged: each overlay carries a `startTime` and `duration` and renders only when the playhead is within that window. Overlays are positioned as percentage-based absolute divs over the video with configurable font, size, color, alignment, bold/italic/underline, opacity, and text shadow. Click-to-place mode lets the user click anywhere on the video to position a new overlay at that point. Selected overlays show a dashed selection border.

The timeline renders video and audio clip lanes with a zoomable ruler (5-second tick marks), a draggable playhead, and per-clip controls: click to select, double-click to split at the playhead, delete button, and drag-to-reorder. Clips are color-coded by type (green for video, orange for text, blue for audio). Click anywhere on the timeline ruler to seek.

Frame extraction pulls up to 100 frames at configurable intervals (0.1s to 10s) by seeking the video element to each target time and drawing to a 160x90 thumbnail canvas. Extracted frames display in a scrollable strip below the video with timestamps, and clicking a frame seeks the video to that time. A frame-to-video rebuild pipeline renders timeline clips and text overlays to a canvas via `captureStream` + `MediaRecorder` at 15fps.

Playback controls include play/pause, loop toggle, rewind/skip 15s, previous/next frame (33ms steps), mute/volume slider, and six playback rate presets (0.25x through 4x). Undo/redo snapshots the full editor state (timeline clips, text overlays, frames, viewport transforms) with a 20-entry rolling stack and a 30-second auto-save interval. Keyboard shortcuts: Space for play/pause, arrow keys for 1s/15s seek, Ctrl+Z/Shift+Z for undo/redo, Ctrl+C for crop mode, Ctrl+T for text placement mode.

Export dialog offers format (MP4, MOV, WebM, AVI), quality (480p to 4K), and resolution (original, 720p, 1080p, 4K) selection.

#### PDF Editor
PDF rendering through an iframe pointed at a blob URL with the native browser PDF viewer, parameterized with `#page=1&zoom=page-width&view=FitH&navpanes=0` to suppress the navigation panes and fit horizontally. The Export menu writes the original file back out as a download. Intentionally minimal: no annotation layer, no form-field handling, no re-encode pass.

#### 3D Viewer
A magic-byte and header-text format detector dispatches to four format-specific parsers. STL handles both ASCII and binary, with per-triangle normal extraction and a fallback to computed vertex normals when the source normals are zero. OBJ handles material slot parsing, per-vertex normals when provided, and fan triangulation of n-gon faces. PLY handles ASCII and binary in both little- and big-endian flavors, with header property parsing that drives a type-dispatched scalar reader for char/uchar/short/ushort/int/uint/float/double. OFF parses the simpler vertex-then-face format from the Princeton Shape Benchmark. GLTF, GLB, DAE, X3D, and 3MF are recognized at the magic-byte level and currently render as icosahedron placeholders pending full parser implementations. Format detection runs against the first 8KB of the file plus structural checks (PK zip header for 3MF, glTF magic 0x46546C67 + version 2 for GLB, text-pattern matches for the rest).

The viewer renders into a Three.js scene with manual orbit/pan/zoom controls implemented from scratch rather than through OrbitControls: spherical-coordinate orbit math with phi clamping at the poles, screen-space pan using camera matrix columns, distance-clamped wheel zoom. The grid auto-scales with camera distance so it stays visually appropriate from extreme close-up to far-out views. Loaded models are auto-centered and scaled to fit a 40-unit target, with normals computed when the source format omits them. Click-to-highlight raycasting toggles the model's material color on hit. A directional pad in the corner dispatches `CustomEvent("movementCommand")` events that the scene picks up to translate or rotate the model with configurable scale and unit (mm/cm/in/°), letting precise transforms run through the pad rather than mouse drags. The axes overlay (X cyan, Y purple, Z dark blue) is toggleable.

#### Tabular Editor
A spreadsheet with a real formula engine. The engine tokenizes formula strings (numbers, A1-style cell refs, `:` range refs, function names, operators), runs Shunting-yard to convert to RPN, and evaluates with cycle detection: a `visiting` set tracks cells currently on the evaluation stack and any re-entry returns `#CYCLE!`, with a memoizing cache reused across the full table compute pass on each edit. Roughly 35 built-in functions covering arithmetic and aggregates (SUM, AVERAGE, MIN, MAX, MEDIAN, STDEV, VAR, PRODUCT, COUNT, COUNTA), conditional aggregates (COUNTIF, SUMIF with `>`/`<`/equality predicates), math (SQRT, ABS, POWER, ROUND, FLOOR, CEILING, LOG, EXP, trig, RAND, PI), logic (IF, AND, OR, NOT), text (CONCAT, TEXT), and date (NOW, TODAY).

Cell editing supports formula-bar cell-picking: when the cursor is positioned inside a function call's argument slot (detected by counting unbalanced parens in the prefix), clicking a cell or dragging across a range inserts the matching `A1` or `A1:B5` reference text into the formula at the active argument boundary, replacing whatever range was previously there. Header-click multi-select extends this so clicking a column header inserts a column-spanning range, and clicking a row header inserts a row-spanning range. While editing, the referenced cells of the current formula get a colored overlay so it's visible at a glance which cells the formula depends on, and a separate semi-transparent overlay marks the range being actively picked.

The grid renders through `react-window`'s `VariableSizeGrid` so 100k+ cell sheets scroll at frame rate. Rows and columns auto-grow on scroll: the visible window minimums (`minNeededRows`, `minNeededCols`) are computed from container dimensions divided by default cell size plus a buffer, and new rows/columns mount in chunks of up to 10,000 at a time when the user scrolls past the current edge. Column filtering renders an "All" / "N selected" trigger button on every column header that opens a portaled dropdown with per-value checkboxes, search-filtering across the value list, and Select All / Clear / Close actions. Active filters tint the column header purple and reduce the visible row set by intersecting all active per-column filters. Selection-aware navigation skips filtered-out rows correctly: arrow keys, Enter, and Tab walk through the filtered visible rows, not the underlying actual row indices.

Selections support multi-cell and full-row/full-column modes, drag-to-move the selection block to a new origin (with a "data being moved will replace existing data" confirmation dialog if the destination is non-empty), Shift+Click to extend, and a bottom-right resize handle that grows the selection by dragging. Copy/cut/paste with relative reference adjustment, paste-over confirmation if the destination has differing content. Sort by column with four modes (A-Z, Z-A, 0-9, 9-0) operating on the selection range when one exists, otherwise the full table; empty cells sort to the end consistently.

A summary panel below the grid renders in two collapsible sections. **Summary Statistics** reports count, mean, median, standard deviation, min, and max for the numeric values in the current selection (or the full table when nothing is selected). **Data Quality** reports null count, N/A count (matched against `n/a` and `null` substrings), missing percentage, unique value count, and duplicate count across the same scope. Both panels update live as the selection changes.

The formula bar at the top of the grid mirrors the active cell's editing buffer with bidirectional sync, and includes a function picker dropdown that inserts `=FUNCNAME(` at the cursor. Cell-level undo/redo runs through a per-cell ring buffer so character-level edits can be undone within an active edit, and cross-cell undo/redo runs through a separate stack at the table-mutation level. Search/replace runs across the full underlying data with case-sensitive toggle and per-match highlighting in the rendered grid. CSV import and export (with last-non-empty-row trimming on export so trailing blank rows don't bloat the file).

#### Rich Text Editor
contentEditable-based rich text editor for `.txt` and `.md` files. Undo/redo runs through a 300ms-debounced string-snapshot history (snapshots `textContent` rather than the DOM tree) with an `isUndoRedoAction` lockout flag that prevents the snapshot logic from firing during programmatic restores. The history is trimmed at the current index on each new edit so redo is correctly invalidated after a divergent change. After save, history clears.

Search runs through a `TreeWalker` over text nodes with a global-offset accumulator that tracks each match's absolute character position across node boundaries, then a separate highlight pass wraps matches in `<span class="search-match">` (or `search-match-active` for the current cursor) by rebuilding the affected text node's children as a document fragment. The active match auto-scrolls into view via `scrollIntoView`. Replace and Replace All apply edits in reverse order so earlier replacements don't shift the offsets of later ones.

Special character picker covers four categories with explicit symbol arrays: math operators and relations (≈200 symbols, ∀ through ⋿), Latin extended (À through ÿ), Greek (Α through ω), and punctuation (— – « » ¶ † etc.). Insertion goes through `document.execCommand("insertText")` so the contentEditable's native cursor position is respected and undo state stays consistent.

### Toolkit

Ten plugin pages, all client-side except Dictionary and Thesaurus which call the Merriam-Webster API.

#### Math / Computation

##### Calculator
Scientific calculator with a custom Shunting-yard tokenizer and RPN evaluator. Implicit multiplication (`2x` parses correctly), multi-letter variable splitting against the user's defined-variables dictionary so `xyz` resolves to `x*y*z` if all three are defined (greedy longest-match against known names, falling back to single-letter splits when no dictionary match exists), and a function table of roughly 40 entries: trig (sin, cos, tan, sec, csc, cot) and inverse trig (asin, acos, atan, atan2, asec, acsc, acot) with a rad/deg toggle that converts inputs to inverse-trig outputs in the active mode; hyperbolics (sinh, cosh, tanh, sech, csch, coth) and inverse hyperbolics (asinh, acosh, atanh, asech, acsch, acoth); exp, ln, log (base 10), logn (arbitrary base); sqrt, cbrt, pow, root; abs, floor, ceil, round, sign; hypot (variadic), clamp, mod, max/min/avg (variadic); fact (capped at n=170), perm, comb; toRad, toDeg.

Live symbol formatting transforms input as the user types: `sqrt(` becomes `√(`, `**` and `^` map to exponent form, `*` rendered as `×` (with negative-lookbehind/ahead so it doesn't trigger inside identifier names), `<=`/`>=`/`!=` to `≤`/`≥`/`≠`, the full lowercase Greek set (alpha, beta, gamma, delta, epsilon, theta, lambda, mu, sigma, phi, omega, tau) plus pi/tau/infinity, and `+-`/`-+` to `±`/`∓`. Pipe characters auto-toggle between `abs(` and matching `)` based on whether an absolute-value scope is currently open.

Fraction mode runs exact rational arithmetic. Float-to-fraction conversion uses continued-fraction expansion with a 1,000,000 max-denominator ceiling. Power operations check for perfect-nth-root reductions on `(p/q)^(m/n)` (split into integer-part-plus-fraction-part with `integerNthRootIfPerfect` testing q-th root candidates ±2 around the float approximation) and fall back to float on failure. Display formatting renders unicode superscript exponents (digits, +/-, decimal point, parens, plus most Latin letters), unicode fractions (`³⁄₄`) assembled from numerator+`⁄`+denominator, and subscript log bases. Variable assignment (`a = 5`, then use `a` in subsequent expressions) persists in-memory for the session and clears on reload.

Equation solving (any expression with `=`) extracts a single variable to solve for (prefers `x` if present, otherwise the single detected variable), then tries bisection across seven hardcoded search ranges (`[-1e6, 1e6]` down through `[-5, 5]`), returning immediately on the first sign-change result. If all bisection attempts fail, falls back to Newton's method seeded from eleven points (0, ±1, ±2, ±5, ±10, ±100). Newton is the fallback, not a refinement step.

Settings modal exposes: fraction-mode toggle, angle-mode toggle (rad/deg), rounding-mode toggle (decimal places vs significant figures, both 0/1-15), scientific-notation toggle with a configurable exponent threshold (1-12), and a live variables list with per-variable delete buttons.

##### Factoring
Six modes via tabs, each with step-by-step working displayed in the history pane below the result. Prime factorization uses trial division with `divisor*divisor > num` early-exit and exponent grouping (`120 = 2³ × 3 × 5`). Euclidean GCD with full quotient-remainder log per step. LCM via `a*b/gcd`. Divisor enumeration loops `i` up to `sqrt(n)` pushing both `i` and `n/i` per hit, dedups perfect-square self-pairs, sorts ascending.

Quadratic factoring (`ax² + bx + c`) routes through a preprocessor that handles three input shapes before parsing: outer-parenthesis stripping (recursive), binomial-product expansion (`(x+1)(x+2)` form, parsed as two binomials and FOIL'd into standard form), and coefficient-times-polynomial expansion (`2(x²+3x+1)` form, distributing the leading scalar across the inner polynomial). Once in standard form, the engine computes the discriminant, branches on sign (negative returns "No real factors", non-perfect-square positive returns the four-decimal-place irrational roots without claiming a factorization), and reconstructs `a(x - r₁)(x - r₂)` for the integer-root case. Linear fallback when `a=0` (with optional GCF extraction). GCF extraction mode pulls the greatest common factor across coefficients out of the polynomial; returns the input unchanged when GCF ≤ 1.

Step-by-step history is tagged with the mode used (rendered as `[MODE]` prefix). Different modes accept different input shapes: integer/divisors take a single integer with comma-stripping, GCD/LCM take comma-separated pairs, polynomial/GCF take expression strings. Output formatting converts `*` to `×` and bare hyphens to typographic minus `−`.

Shares the live symbol-formatting layer with Calculator and Plot (the same superscript/subscript maps, fraction-assembly, log-base subscripting, and `applySymbolFormatting` pipeline drives all three pages).

##### Matrix
Up to 10x10 dual-matrix workspace (A and B, each independently sized). Operations include addition, subtraction, scalar multiplication on either matrix, transpose on either matrix, A×B and B×A as separate matrix-multiply operations, determinant via partial-pivot LU decomposition, **inverse via Gauss-Jordan elimination** (augments `[A|I]`, runs RREF, slices off the right half — the README of an earlier version called this LU-based, but it's RREF-based), RREF via Gaussian elimination with a row-operation log (each swap, scale, and subtract step recorded), rank derived from the post-RREF nonzero-row count, Ax=b solver via LU forward/back-substitution (with `B` overloaded as the right-hand-side column vector), and dominant eigenpair approximation via 1000-iteration power iteration with a `1e-10` convergence tolerance.

Cell values render with a heatmap background scaled to the global min/max across both input matrices and the result simultaneously (so heatmap cells are comparable across all three grids). Hue 210 (blue) for negative values, hue 0 (red) for positive, dead-zone bypass for `|t| < 0.15`. Templates (zero, identity, random) for fast setup. Random fills with values in `[-10, 10]` rounded to one decimal. Import accepts CSV, whitespace-delimited, or semicolon-delimited input via a textarea (with row-by-row zero-padding for ragged input). Export writes CSV, JSON, or LaTeX (`\begin{bmatrix}...\end{bmatrix}`) to clipboard, plus a separate Download CSV button. A 50-entry rolling history shows past results with Preview, → A, and → B buttons that route any historical result back into the workspace.

Eigen output stacks the eigenvalue as the first row above the eigenvector (so a 3x3 matrix produces a 4x1 column). Only the dominant eigenpair is computed.

##### Plot
Custom HTML5 canvas grapher with no third-party charting libraries. The viewport runs through a manual coordinate transform (`mathToScreen`/`screenToMath`) for shape hit-testing and rendering. Three function modes — `f(x)`, `d/dx`, and `∫f` — are display-only labels that change the prefix string in the formula bar (`y = `, `y' = `, `∫y = `); the user types whatever expression they want plotted, and there's no symbolic differentiation or integration step. The "derivative" and "integral" modes don't compute anything special; they're a UI hint, and the user types the derivative or antiderivative themselves.

Multiple formulas can be plotted simultaneously, each with its own color, visibility toggle, and per-axis shading mode (to x-axis or to y-axis, rendered at ~15% alpha). The expression parser uses string substitution into a JavaScript expression that's then `eval`ed under namespaced `window.SAFE_MATH.*` and `window.CONSTANTS.*` aliases. Roughly the same 40-function table as the Calculator (sin/cos/tan + sec/csc/cot + their inverses, hyperbolics + reciprocals + their inverses, exp/ln/log/logn, sqrt/cbrt/pow/root, abs/floor/ceil/round/sign, hypot/clamp/fact/perm/comb, toRad/toDeg). The `sum`, `prod`, `integral` function names are accepted but evaluate to identity; they're symbol placeholders, not actual reductions. Implicit multiplication is inserted automatically (digit-letter, digit-paren, paren-digit, paren-paren, letter-digit; identifier-paren is preserved when the identifier is a known function name).

Built-in constants table covers mathematical constants (pi, e, tau, phi/golden ratio, gamma/Euler-Mascheroni) plus the physics set (c, G, h, hbar, k, R, NA, qe, eps0, mu0, me, mp, mn, g0, sigmaSB, Ry, alpha, ke).

Interactive shapes (circle, triangle, rectangle, polygon) render alongside the function plots. Each shape type supports drag-to-translate via a centroid handle, plus per-vertex or per-handle resize/reshape: circle has a radius drag handle, triangle has three vertex handles, rectangle has a bottom-right corner resize handle, polygon has per-vertex handles plus add/remove-vertex buttons in the sidebar (minimum three vertices enforced). All four shape types have an optional fill toggle (~15% alpha). Hit-testing runs in screen space against shape control points with a 10-pixel proximity threshold for handles and a 5-pixel band around the circle perimeter for body grabs.

Bisection-based intercept finder samples the visible x-range at 4000 points, identifies sign changes between consecutive samples, and refines each candidate with 50 iterations of bisection. Adds the y-intercept (`f(0)`) when 0 is in the visible x-range. Dedups intercepts by `1e-4` tolerance. Detected intercepts render as colored dots with white-bordered labels showing `(x, y)` to 3 decimal places, drawn directly onto the canvas.

Auto-detected variables in formula text prompt the user to add them as sliders (range `[-10, 10]`, step 0.1). Rad/deg toggle wraps trig inputs and inverse-trig outputs accordingly. Zoom in / zoom out / reset zoom buttons rescale the math viewport by 0.9x / 1.1x around its center. Virtual keyboard panel with a numbers/operators row and a functions/constants row covering Greek letters, fractions, and most of the function table.

#### Design / Media

##### Background Remover
Four removal modes. Smart samples 10x10-pixel blocks from each of the four corners (up to 400 corner samples per image) and uses those as flood-fill seed colors. Color-key chroma-keys to a single picked color and runs as a full-image scan rather than a flood-fill, so disconnected matching regions all get removed. Edge-detect samples colors along the four image edges at a `width/20` step interval and treats those as targets for the flood-fill. Corner sampling grabs the four exact corner pixels and floods from there.

For all modes except color-key, the core algorithm is an 8-connected BFS flood-fill seeded from edge pixels (top/bottom rows and left/right columns), with RGB Euclidean-distance tolerance against the target color set. The fill walks both cardinal and diagonal neighbors, which handles thin diagonal seams correctly. After the mask is built, an optional feather pass runs a BFS distance transform inward from the mask boundary, then applies a quadratic alpha falloff (`alpha = 1 - (d/smoothing)²`) to soften the mask edge within a configurable feather radius (0-10 pixels).

Tolerance is configurable via slider (1-100) with named presets (Low/Medium/High/Maximum at 10/30/60/100). Background replacement is a solid color only; there's no image-replacement path. Output as PNG, JPEG, or WebP, with JPEG quality hardcoded at 0.9.

##### Color Type Lab
Brand palette generator (primary, secondary, accent) with HSL-based tint and shade derivation, configurable from 2 to 8 steps in each direction (lightness shifts of ±0.06 per step). Randomize button generates HSL-constrained random brand colors (saturation 0.6-0.9, lightness 0.45-0.55).

Data-viz palette generation in three modes: sequential (RGB linear interpolation between two user-picked endpoint colors, so the hue can shift between endpoints), diverging (interpolation between two endpoints through a hardcoded white midpoint), and qualitative (evenly-spaced hues at fixed saturation and lightness, with configurable start hue, saturation, and lightness sliders). Configurable color count from 3 to 12.

WCAG contrast checker with proper sRGB linearization (gamma decode via `(c+0.055)/1.055)^2.4` above the threshold, linear below), runs all four pass tiers (AA normal at 4.5:1, AAA normal at 7:1, AA large at 3:1, AAA large at 4.5:1) for any pair. Two-stop linear gradient editor with configurable angle (0-360°). Color harmony rules: complementary (180°), analogous (-30°/0°/+30°), triadic (0°/120°/240°), tetradic (0°/90°/180°/270°), and monochromatic (lightness shifts -0.2/0/+0.2).

Image color extraction from an uploaded image: the input is resized to a max 400px dimension preserving aspect, then RGB channels are bucketed at 5-step increments per channel (`Math.floor(channel/5)*5`), pixels with alpha < 128 skipped. Buckets are deduplicated by Euclidean RGB distance with a 15-unit minimum separation, then sorted with **saturated colors prioritized over desaturated ones** (saturation > 0.15 ranks higher) before falling back to occurrence count. An "Apply Colors" button maps the extracted palette into the brand and gradient slots automatically (slots 0/1/2 → primary/secondary/accent, 3/4 → diverging endpoints, 0+5 → gradient endpoints).

Modular type scale generator with configurable base size and a five-option ratio dropdown (minorThird 1.2, majorThird 1.25, perfectFourth 1.333, perfectFifth 1.5, golden 1.618). Configurable step range (default -2 to +8) and live preview at each step. Variable-font axis controls (weight, width, slant, optical size) applied via `font-variation-settings` on a sample-text preview. Exports as design tokens (JSON), CSS variables, or Tailwind theme config (mapping the modular scale to xs/sm/base/lg/xl/2xl/3xl/4xl/5xl/6xl with `base` anchored at index 2). All three exports support copy-to-clipboard and download.

##### Compression Lab
Image compression via canvas resize-and-reencode with format conversion (JPEG, PNG, WebP) and a quality slider (10-100%, ignored for PNG since it's lossless). PNG/JPEG/WebP run through `canvas.toBlob` after redrawing through optional resize. Resize supports either freeform width/height inputs or a set of presets (4K, 1440p, 1080p, 720p, 480p), with an aspect-ratio toggle that scales the longer dimension first.

Text-like file compression (text/*, JSON, JS, XML, CSS, HTML, CSV) runs through a custom dictionary-based compress pass. Binary file compression uses the browser's native `CompressionStream` API with gzip and a streaming reader/writer pattern. Already-compressed file types (audio/*, video/*, application/pdf, .zip, .rar, .7z, .mp3, .mp4, .webm, .jpg, .jpeg, .png, .webp) get detected and pass through unchanged with a 0.0% reduction marker.

The output-format dropdown also lists MP4/WebM/MP3/ZIP options inherited from a planned transcoding pipeline; those are non-functional in the current build and route image inputs through the standard image path. Side-by-side panels show original and compressed file sizes per file, plus aggregate Original Size, Compressed Size, and Space Saved (%) summary stats. Per-file dimensions appear on image outputs.

#### Reference / Utility

##### Dictionary
Merriam-Webster Collegiate JSON API client. The key resolver checks several env-var names in order (`VITE_REACT_APP_MW_DICTIONARY_KEY`, `VITE_REACT_APP_MW_DICT_KEY`, `VITE_MW_DICTIONARY_KEY`, `VITE_MW_KEY`, plus the legacy `process.env.REACT_APP_*` and `process.env.MW_*` equivalents). With no key set, the page renders a setup banner and refuses to fetch. Returns either suggestion chips (when the query doesn't match a headword, capped at 12 chips) or normalized entry cards with headword (asterisks converted to `·` middle-dot syllable separators), part-of-speech, up to six short definitions, and a "View Full Entry" link to merriam-webster.com (resolved from `meta.id` with the colon suffix stripped, opened with `target="_blank" rel="noopener noreferrer"`).

##### Thesaurus
Sibling to Dictionary, hits the Merriam-Webster Thesaurus API. The key resolver checks `VITE_REACT_APP_MW_THESAURUS_KEY`, `VITE_MW_THESAURUS_KEY`, `VITE_REACT_APP_MW_THES_KEY`, plus `process.env.REACT_APP_*` and `process.env.MW_*` equivalents. Walks the `def[].sseq[][]` structure to extract `syn_list` and `ant_list` buckets. Synonyms preserve their bucket-per-sense structure and render as multiple chip rows, capped at 3 buckets per entry and 10 chips per bucket (with a 24-chip flat fallback when buckets are empty). Antonyms get flattened into a single chip row capped at 16 chips. The same suggestion-chip fallback fires when MW returns string suggestions (capped at 10). Renders the same `meta.id`-based offsite link to merriam-webster.com/thesaurus/{slug}, with `target="_blank" rel="noopener noreferrer"`, and the same headword middle-dot syllable conversion via `*` → `·`.

##### Timestamp Lab
Live unix-second and unix-milliseconds counters that update every 100ms (with a Pause/Resume button), bidirectional unix to human conversion with a seconds/milliseconds unit toggle on the unix input, and a date/time picker with a "Use This Date" sync button that pushes the picker's value into the unix input. 37-zone IANA timezone grid that converts the configured timestamp to every zone simultaneously (the grid covers UTC, eleven Americas zones, the major European/Asian/Australasian/African zones, and Pacific outliers).

Date difference calculator computes scalar deltas (milliseconds, seconds, minutes, hours, days, weeks, months, years) plus a Y-M-D-H-M-S breakdown object; the sidebar UI surfaces the days/weeks/months scalars from the result. Months use a 30.44-day average and years use 365.25 days, so non-calendar-aware approximations near month boundaries are expected.

Add/subtract time across all units (seconds through years) with operation toggle, applied via the appropriate JavaScript Date setter (so calendar-aware for months/years, additive for the smaller units). Stopwatch with 10ms tick precision (`setInterval` at 10ms), formatted as `HH:MM:SS.cc`.

Date metadata panel reports ISO week number (configurable Sunday/Monday start), day-of-year, quarter, leap year flag, weekday name, and UTC offset (in minutes, from the browser's local offset). Multi-epoch conversion across Unix (1970), Windows FILETIME (1601, with the correct 100-nanosecond-tick scaling), Mac HFS+ (1904), Cocoa NSDate (2001), and GPS (1980). Format-template reference list (ISO 8601, ISO Date, US/EU formats, full datetime, 12-hour time, RFC 2822, unix timestamp, milliseconds) — these are reference strings only; the page doesn't apply them to the configured timestamp. JSON export bundles the input config, six conversion outputs (ISO 8601, RFC 2822, unix seconds/ms, relative time like "3 days from now", and the human-readable string in the selected timezone), the full timezone conversion table, and the metadata block. Both Copy and Download buttons.

---

## Architecture

DinoLabs is a two-repo project: a React frontend (`dinolabsweb/`) and a Node.js/Express backend (`dinolabs_webapi/`). The backend serves only the calendar CRUD routes, the database connection proxy, and the Dino Auth integration. The frontend handles all rendering, file I/O, editing, and computation.

### Frontend (`dinolabsweb/`)

```
dinolabsweb/
├── public/
│   ├── language-images/         Per-language icon set for the Code Editor
│   ├── ref-images/              Reference imagery
│   ├── ref-logos/               Brand assets
│   ├── DinoLabsLogo*.png
│   └── SolarSystemBackground.mp4
├── src/
│   ├── pages/
│   │   ├── Authentication/
│   │   │   ├── AuthLogin.jsx
│   │   │   ├── AuthRegister.jsx
│   │   │   ├── AuthReset.jsx
│   │   │   └── AuthVerifyEmail.jsx
│   │   ├── DinoLabsAccount/
│   │   │   ├── DinoLabsAccount.jsx
│   │   │   ├── DinoLabsCalendar.jsx
│   │   │   ├── DinoLabsDatabase.jsx
│   │   │   ├── DinoLabsMonitoring.jsx
│   │   │   └── DinoLabsTeam.jsx
│   │   ├── DinoLabsCode/
│   │   │   ├── DinoLabsLint/    Per-language linting scripts
│   │   │   ├── DinoLabsMarkdown.jsx
│   │   │   ├── DinoLabsMirror.jsx
│   │   │   └── DinoLabsParser.jsx
│   │   ├── DinoLabsMedia/
│   │   │   ├── DinoLabsAudioEditor/
│   │   │   ├── DinoLabsImageEditor/
│   │   │   ├── DinoLabsPDFEditor/
│   │   │   ├── DinoLabsThreeDEditor/
│   │   │   └── DinoLabsVideoEditor/
│   │   ├── DinoLabsPlugins/
│   │   │   ├── DinoLabsPluginsBackgroundRemover/
│   │   │   ├── DinoLabsPluginsCalculator/
│   │   │   ├── DinoLabsPluginsColorTypeLab/
│   │   │   ├── DinoLabsPluginsCompressionLab/
│   │   │   ├── DinoLabsPluginsDictionary/
│   │   │   ├── DinoLabsPluginsFactoring/
│   │   │   ├── DinoLabsPluginsMatrix/
│   │   │   ├── DinoLabsPluginsPlot/
│   │   │   ├── DinoLabsPluginsThesaurus/
│   │   │   ├── DinoLabsPluginsTimestampLab/
│   │   │   └── DinoLabsPlugins.jsx     Plugins Hub launcher
│   │   ├── DinoLabsTabular/
│   │   │   └── DinoLabsTabularEditor.jsx
│   │   ├── DinoLabsText/
│   │   │   └── DinoLabsRichTextEditor.jsx
│   │   ├── DinoLabs.jsx                Workspace shell
│   │   ├── DinoLabsFileTypeMap.jsx     File extension to editor routing
│   │   └── DinoLabsNoFileSelected.jsx
│   ├── helpers/
│   │   ├── PlottingHelpers/
│   │   │   ├── DoughnutHelper.jsx
│   │   │   └── LineHelper.jsx
│   │   ├── Alert.jsx
│   │   ├── ColorPicker.jsx
│   │   ├── Loading.jsx
│   │   ├── Mobile.jsx
│   │   ├── Nav.jsx
│   │   └── Unavailable.jsx
│   ├── styles/
│   │   ├── helperStyles/        Shared component styles
│   │   └── mainStyles/          Per-page styles, plus MirrorThemes for code editor
│   ├── App.jsx
│   ├── ErrorBoundary.jsx
│   ├── ProtectedRoute.jsx       Token gate, redirects to Dino Auth
│   ├── TouchDevice.jsx          Mobile-block screen
│   └── UseAuth.jsx              Dino Auth hook
├── Dockerfile
├── eslint.config.js
├── vite.config.js
└── vercel.json
```

### Backend (`dinolabs_webapi/`)

```
dinolabs_webapi/
├── api/
│   ├── config/
│   │   ├── db.js                PostgreSQL pool
│   │   ├── s3.js                Object storage client
│   │   └── smtp.js              Transactional mail
│   ├── middleware/
│   │   ├── auth.js              Dino Auth token validation
│   │   ├── errorLogger.js
│   │   └── rateLimiter.js
│   ├── routes/
│   │   └── dinolabs-playground/
│   │       ├── dinolabs-playground-calendar.js
│   │       └── dinolabs-playground-database.js
│   ├── workers/
│   │   └── connectionManager.js  Per-user PostgreSQL connection pool
│   ├── public/                   Catchall and static
│   ├── docs/
│   └── index.js
└── vercel.json
```

The route namespace is intentionally minimal. Calendar handles event CRUD. Database handles connection management (save, load, delete, test) plus query execution proxying with AES-256-CBC encrypted credential storage. Everything else (auth, profile, team, billing) routes through Dino Auth as a pass-through.

### Persistence
- **File System Access API.** Modern Chromium browsers get direct file handles, so opening a file once gives the editor read/write access to it on subsequent sessions without re-prompting. Edits save back to the original file on disk.
- **IndexedDB.** The fallback persistence layer for browsers without File System Access API support, and the working-buffer store for unsaved changes regardless of browser. Survives reloads.
- **Session state.** Open files, editor positions, panel visibility, and per-page settings persist in IndexedDB so the workspace restores on next visit.
- **PostgreSQL.** Backend storage for calendar events and saved database connection metadata only. No file content ever touches the backend.

### Three.js
Used in two places: the 3D Viewer (geometry rendering for STL/OBJ/PLY/OFF files) and the Plot toolkit page (interactive shapes overlaid on the canvas grapher). Both use manual orbit math rather than OrbitControls.

### Linting
Per-language linting scripts live in `pages/DinoLabsCode/DinoLabsLint/`. Each script exports a `lint(source)` function that returns an array of diagnostic objects (line, column, severity, message), and the editor surfaces them as gutter markers and underlines. Adding a new language is a matter of dropping a new file in that directory.

### Data sources
- **Merriam-Webster Collegiate.** Dictionary plugin (frontend-direct, requires API key).
- **Merriam-Webster Thesaurus.** Thesaurus plugin (frontend-direct, requires API key).
- **Browser APIs.** Everything else. The Monitoring page is built entirely from `navigator.*`, `Performance.*`, `Battery.*`, `WebGL/WebGPU`, and `MediaDevices.*` calls.

---

## Authentication and accounts

Account creation, login, sessions, password resets, email verification, organization management, and role-based access are **all handled through Dino Auth**, a separate private API internal to the broader DinoLabs architecture. Dino Auth is **not part of this repository**, is not open-sourced, and is not available for self-hosting. DinoLabs is simply integrated with it: the platform does not implement its own auth, does not store passwords, and does not roll its own session management.

What this means in practice:

- Sign-up, login, reset, and verification flows all proxy through Dino Auth.
- Sessions come back as bearer tokens with embedded user ID and optional org ID.
- Team management (inviting members, role assignment, org-level settings) lives in the `DinoLabsTeam.jsx` page on the DinoLabs frontend but proxies all writes through Dino Auth.
- Every protected route on the DinoLabs backend validates tokens against Dino Auth.
- The `ProtectedRoute.jsx` component on the frontend handles redirects and token refresh transparently.

**Existing DinoLabs accounts work here.** If you already have an account from one of our other open-source DinoLabs platforms (DinoSat, etc.), those credentials sign you straight into DinoLabs. One account, every product. Forks intending to run standalone will need to swap in their own auth provider.

---

## Hosted version

The intended way to use DinoLabs is the hosted version at **[DinoLabs](https://dinolabs.app)**. It runs on infrastructure that handles the file-handle quotas, IndexedDB sync, and the calendar/database backend, and accounts are free.

This repository exists primarily as a reference and as the development home of the project. Self-hosting is possible but is not the supported path.

---

## Setup (self-hosting)

If you do want to run it yourself, this is roughly what you're signing up for.

### Requirements
- Node.js 20 or later
- PostgreSQL 15 or later
- Modern Chromium browser (for File System Access API support; other browsers fall back to IndexedDB-only)
- API keys: Merriam-Webster Dictionary, Merriam-Webster Thesaurus

### Build

Both repos run independently.

**Frontend (`dinolabsweb/`)**
1. `npm install`
2. Create a `.env` with the API base URL, auth provider config, and Merriam-Webster keys
3. `npm run dev` for local development, `npm run build` for production

**Backend (`dinolabs_webapi/`)**
1. `npm install`
2. Create a `.env` with database URL, S3 credentials, SMTP config, and auth provider config
3. `npm run db:migrate`
4. `npm run dev` for local, `npm start` for production

### Environment variables
No `.env.example` is shipped with this repo. The ones you cannot skip on the backend:

- `DATABASE_URL`
- `AUTH_PROVIDER_URL`
- `AUTH_JWT_PUBLIC_KEY`
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`

On the frontend:

- `VITE_API_BASE_URL`
- `VITE_AUTH_PROVIDER_URL`
- `VITE_REACT_APP_MW_DICTIONARY_KEY`
- `VITE_REACT_APP_MW_THESAURUS_KEY`

---

## Design notes

- **Client-side first.** Every editor and every toolkit plugin runs in the browser. The backend exists for the two cases that genuinely need shared state (calendar events visible across devices) or credentialed proxying (database connections that can't safely live in client-side code). Everything else is local. This keeps the privacy model simple: file content never leaves the browser unless the user explicitly exports it.
- **Real persistence, not draft-only.** File System Access API gives the editors actual read/write file handles on disk. Opening a file once means subsequent edits save back to the original location with no upload/download dance. This is a different model than most browser-based editors and is the main reason DinoLabs targets Chromium.
- **No third-party editor frameworks.** The Code Editor is `DinoLabsMirror`, not Monaco or CodeMirror. The Tabular Editor's formula engine is from-scratch, not HyperFormula or Formula.js. The Plot grapher is canvas, not Chart.js or Plotly. The reasons are partly bundle size, partly the fact that most third-party editor libraries have opinions about the surrounding UI that fight the workspace shell, and partly that it's more fun this way.
- **Per-language linting is pluggable.** Adding a language to the Code Editor's lint pipeline means dropping a new file in `DinoLabsLint/` that exports a `lint()` function. No registration, no config, no rebuild step beyond the normal Vite reload.
- **The Toolkit is a workshop, not a single-purpose tool.** The ten plugins share a launcher and a common chrome but are otherwise independent. The Calculator, Plot, and Factoring pages share a symbol-formatting engine (superscript exponents, unicode fractions, log subscript bases, RPN evaluation) because the code legitimately reuses, but everything else is self-contained.
- **Desktop only, by design.** Multi-pane editors with file-tree sidebars and toolbars do not work on phones, and trying to gracefully degrade burns more time than it saves. `TouchDevice.jsx` shows a desktop-only message on touch devices instead of trying to fit the workspace into 380 pixels.
- **The Monitoring page reads, never writes.** Everything it surfaces comes from browser APIs that the user already has access to. It exists because finding all of those values in dev tools is annoying, not because DinoLabs is doing anything special with them.

---

## Limitations and known issues

- File System Access API is Chromium-only. Firefox and Safari fall back to IndexedDB, which means files have to be re-uploaded each session and exports go through the download dialog rather than saving back in place.
- The Code Editor's regex-based tokenizer is fast but not as accurate as a true parser. Edge cases in nested template literals, JSX inside TypeScript generics, and language-specific operator overloading occasionally produce mis-highlighting. Adding a tree-sitter pass for the most-used languages is on the roadmap.
- The Database Explorer's connection manager pools per-user, but very long-running queries can starve the pool. Per-query timeouts mitigate this but don't eliminate it.
- Dictionary and Thesaurus require Merriam-Webster API keys. Without them the plugins display a setup banner and don't function. The free tier is rate-limited.
- The PDF Editor's annotation layer round-trips through a re-encode pass on save, which means PDFs with form-field signatures or DRM may not save cleanly.
- Three.js scenes in the 3D Viewer with very large meshes (10M+ triangles) get sluggish on integrated graphics. The directional pad and orbit controls are designed to compensate, but a desktop GPU is the realistic target.

---

## License

Apache License 2.0 with a Commons Clause restriction. You can read it, fork it, modify it, and run it for non-commercial purposes. You cannot sell it, sublicense it, or offer it as a hosted commercial service. The intent is to keep the code open as a reference while reserving commercial rights. See `LICENSE` for the full text.
