# Visual assets

`runtime-overview.svg` describes profile selection and participating hook context limits. `social-preview.svg` is a source-controlled repository card. Neither image claims to record automatic agent execution or measured token savings.

Regenerate the static SVG files from the repository root:

```bash
node assets/generate-static.mjs
```

The images use system fonts and have accessible titles/descriptions. `assets/social-preview.png` and the root `social-preview.png` are the same 1200 × 630 render of `social-preview.svg`; both were visually inspected. To update them, render the SVG with a browser at that viewport and review the result before copying it. Changing a repository file does not change the GitHub repository's social-preview setting; that setting requires a separate upload.

## Current runtime GIF

[`runtime-demo.gif`](runtime-demo.gif) is a seven-second, 1120 × 630, silent product diagram. It illustrates the default core and selected opt-in profiles; it is not a live execution recording, an exhaustive profile list or a token benchmark. The `dashboard` profile also adds local monitoring to core.

Its [editable HyperFrames source and reproduction instructions](runtime-demo-source/README.md) are checked in. `profile-data.json` records frozen manifest-derived values. After changing profile data, regenerate, render and visually review it. Runtime requirements and local dependency/license notices live with the source.

## Historical terminal GIFs

`gif1-numbers.gif` through `gif5-bigpicture.gif` are retained as historical media. They illustrate earlier catalog totals and opt-in legacy workflows. They are not current defaults, end-to-end tests or performance evidence, and current documentation does not embed them.

The old VHS tapes under `tapes/` refer to `/tmp/vibe-gifs/*.sh` generators that are not in this repository. Those tapes alone cannot reproduce the GIFs. A replacement animation needs checked-in source, current real CLI output or a clear conceptual label, and a truthful caption. Do not regenerate these as apparent live product recordings from fabricated shell output.
