# Runtime profile GIF

Editable source for [`../runtime-demo.gif`](../runtime-demo.gif): an eight-second,
1120×630, silent diagram of the default runtime and opt-in profiles. It illustrates
the product configuration; it is not a screen recording or a token benchmark.

Regenerate from the repository root after changing profile data:

```sh
cd assets/runtime-demo-source
npm run generate
npm run check
npm run dev
npm run render
```

Requirements: Node.js 22+, FFmpeg and Chrome Headless Shell supported by the
pinned HyperFrames CLI. Set `HYPERFRAMES_BROWSER_PATH` to an existing headless-shell
binary. Rendering is local. The first `npx` invocation downloads the pinned CLI.

`source-data.mjs` reads the repository version, runtime manifest and filtered hook
registrations. `generate.mjs` freezes that data into the scene so the composition
does not fetch data or use a clock at render time. `profile-data.json` records the
values used by the committed GIF. Rebuild and review the GIF after any data change.
`compositions/profiles.template.html` is the editable scene template; its generated
`profiles.html` is what HyperFrames renders.

The local `lib/gsap.min.js` is GSAP 3.15.0, copied from the pinned HyperFrames
distribution with its copyright and license notice preserved. See its file header
for the [GSAP standard license](https://gsap.com/standard-license/).
The local Inter 400/700 fonts are distributed under the SIL Open Font License in
`assets/fonts/OFL-inter.txt`.
