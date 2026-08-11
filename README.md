# X Article to Markdown

Browser extension (Chromium + Firefox, Manifest V3) that exports the article you're currently reading on X (x.com) into a clean, **Obsidian-ready Markdown** file.

## Single purpose

Export one article at a time to Markdown. That's it. Open any article on X, click the extension icon, then click **Download markdown** — a `.md` file downloads.

The exported file includes YAML frontmatter with the author, handle, publication date and source URL, so your notes always retain attribution.

## Privacy

**This extension collects no data.**

- No analytics, no cookies, no fingerprinting
- No third-party services, no remote code, no background processing
- No network requests at all
- Everything runs locally in your browser; the exported file is saved only to the location you choose

This is a hard design invariant. If a future version ever changes data handling, it will be disclosed here and in the store listing before release.

## Permissions

Only two, and both are minimal:

| Permission | Why |
|---|---|
| `activeTab` | Grants temporary access to the current tab — but only when you click the extension icon |
| `scripting` | Injects the extraction function into that tab so it can read the article DOM |

No host permissions, no site-wide access, no `storage`, no `cookies`.

## Usage

1. Install from the Chrome Web Store, or grab the latest **release** from [the Releases page](https://github.com/devtoubkal/x-article-to-markdown/releases), unzip it, and load it as an unpacked extension.
2. Open an article on x.com (an X **article** page — not a timeline or a plain tweet).
3. Click the extension icon.
4. A preview shows the article title and a **Download markdown** button — click it and choose where to save the `.md` file.

The popup only activates on `x.com` / `twitter.com` article pages; on any other page or non-article X page it shows a message instead.

### Demo

<img src="store/demo_chrome.gif" width="60%">


### Firefox

- **Firefox users:** once the add-on is listed on [addons.mozilla.org](https://addons.mozilla.org), installation is one click from the store.
- **Development:** run `bun install && bun run dev:firefox`. This builds the Firefox package (`.output/firefox-mv3`) and launches Firefox via the official `web-ext` tool with the add-on **already loaded** (the temporary add-on reloads on save and disappears when Firefox closes). This is the only supported way to run an unsigned build — Release Firefox refuses unsigned add-ons ("could not be verified") and folders dragged into `about:addons` ("appears to be corrupt"). You can also use `about:debugging` → This Firefox → **Load Temporary Add-on** → `.output/firefox-mv3/manifest.json` manually.
- To distribute on AMO, submit the `-sources.zip` from the [Releases page](https://github.com/devtoubkal/x-article-to-markdown/releases) (AMO builds and signs it; MV3 requires the source package).

## Disclaimer

X Article to Markdown is an independent tool. It is **not** affiliated with, endorsed by, or connected to X Corp. / Twitter.

"X" and "Twitter" are trademarks of their respective owners.

Users are solely responsible for complying with X's Terms of Service and applicable copyright law. This tool is intended for **personal archiving** of content you have legitimate access to. Please do not redistribute exported content, and respect the rights of content authors.

## License

[MIT](LICENSE) © 2026 devtoubkal