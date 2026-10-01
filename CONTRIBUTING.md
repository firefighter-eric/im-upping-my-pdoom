# Contributing

Read PROJECT.md and AGENTS.md. Add new works under projects/ and iterate in new version directories. Keep source bytes and previously delivered versions intact; record references, hashes, prompts, actual models and rights. Unknown creative facts remain TBD.

Run `npm run check`, `npm test`, and `npm run verify:source` before committing. For local production, restore the registered media to its exact paths and verify its hashes, then run `npm run verify`, `npm run verify:media`, and actual video playback. Media is not distributed by this repository. Changes to inputs or creative output belong in a new version. Do not treat generated media as approved without a human approval record.

Video and audio remain local and ignored. Track code, font/image assets, dependency locks, analysis JSON and production/provenance records. Existing LFS attributes remain a safeguard if media publication is explicitly authorized later. Keep node_modules, caches, credentials and model weights out of the repository. The migration archive is historical evidence; shared scripts are the supported execution path.
