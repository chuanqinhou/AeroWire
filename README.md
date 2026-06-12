# AeroWire

AeroWire is a desktop-first wiring editor for multi-board drone hardware diagrams. The current MVP supports:

- importing multiple board photos into one canvas
- placing pin anchors on each board
- connecting pins across boards
- running basic ERC checks
- exporting PNG and JSON project files
- editing board crop and scale

## Local development

Requirements:

- Node.js 22+
- npm 10+

Run the web app:

```bash
npm install
npm run dev
```

Build the frontend:

```bash
npm run build
```

## Desktop app

This project uses Tauri for desktop packaging.

Useful commands:

```bash
npm run tauri:dev
npm run tauri:build
```

On Linux, Tauri also needs system GUI libraries such as WebKitGTK and GTK development packages.

## Windows builds on GitHub Actions

The workflow file is:

`.github/workflows/build-windows.yml`

It supports:

- manual runs via `workflow_dispatch`
- release-style builds when pushing tags like `v0.1.0`

### How to use

1. Push this repository to GitHub.
2. Open the `Actions` tab.
3. Run `Build Windows App` manually, or push a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

### Output

For manual builds:

- download the installer from the workflow `Artifacts`

For tag builds:

- GitHub creates a draft Release
- the Windows installer is attached to that Release

End users do not need Node.js, Rust, or any development environment.
