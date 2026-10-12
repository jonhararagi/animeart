# Asset sources and licenses

## CC0 character image used by the local sample library

- Local file: `web/assets/cc0-detailed-anime-character.png.base64`
- Original file: `battleworn_knight.png`
- Author/publisher: SpriteCook, `spritecook-free-game-assets`
- Source folder: https://github.com/SpriteCook/spritecook-free-game-assets/tree/master/examples/detailed-characters-anime
- Original PNG: https://github.com/SpriteCook/spritecook-free-game-assets/blob/master/examples/detailed-characters-anime/battleworn_knight.png
- Folder license: https://github.com/SpriteCook/spritecook-free-game-assets/blob/master/examples/detailed-characters-anime/LICENSE.txt
- License: **Creative Commons Zero 1.0 Universal (CC0 1.0)**. The folder README and LICENSE state that the assets may be used, modified and shared without attribution requirements. Attribution is appreciated.
- Provenance verification: the decoded local file is 702,974 bytes and its Git blob SHA-1 is `45a20ccca3921a58f22b06ad9bd0c123d9b82708`, matching the original PNG's blob SHA reported by GitHub. It is not merely a similarly named replacement.
- Runtime usage: the file stores the PNG bytes as Base64 text so the static web build can bundle it. The sample button decodes the bytes locally, then adds the image through AnimeArt's existing image-layer import/history/persistence/export path. No upload to a server is required.

## Repository license is not the same as asset license

The main repository's software license does not automatically cover third-party artwork. New artwork must be added here with its original URL, exact author/publisher, and asset-specific license verified first. Do not mark an asset CC0 solely because a filename or search result says "free".
