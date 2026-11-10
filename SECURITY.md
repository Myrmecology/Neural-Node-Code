# Security Policy

Neural Node & Code is built with security in mind from the ground up. This document describes the protections in place, how to report a vulnerability, and the practices maintainers follow to keep the project safe.

---

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

Only the latest release receives security fixes.

---

## Reporting a Vulnerability

If you discover a security issue, please report it **privately**. Do not open a public issue.

1. Use the repository's **private vulnerability reporting** feature (on GitHub: the **Security** tab, then **Report a vulnerability**).
2. Include:
   - a clear description of the issue,
   - steps to reproduce it,
   - the affected file(s) and version,
   - the potential impact.

You can expect an acknowledgment within **7 days**. Confirmed issues will be fixed as quickly as possible, and reporters will be credited unless they prefer to remain anonymous.

---

## Security Measures

### In the Game

- **Content Security Policy:** `index.html` allows scripts only from the game itself. Inline scripts, external scripts, plugins, and form submissions are blocked by the browser.
- **No external network requests:** fonts are bundled locally, there are no analytics or trackers, and the game never contacts an outside server.
- **No code execution from text:** all on-screen text is written with `textContent`, never `innerHTML`. ESLint rules forbid `eval`, `new Function`, and similar patterns.
- **Untrusted storage handling:** the saved high score is strictly validated when loaded, and any browser storage failure is ignored safely.
- **No source maps in release builds,** so the original source is not shipped to players.

### In Development

- **Local-only dev server:** the development and preview servers bind to `localhost` only and send security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`).
- **Strict type checking and linting:** TypeScript strict mode and type-aware ESLint rules catch unsafe code before it runs.
- **Editor safeguards:** VS Code highlights invisible and look-alike Unicode characters that could hide malicious code.

### Dependencies

- **Exact versions:** every dependency is installed with `--save-exact`, and `package-lock.json` is committed, so builds are reproducible and packages cannot silently change.
- **Minimal runtime footprint:** the shipped game depends only on Babylon.js and two font packages. All other tools are development-only and never reach players.
- **Audited:** `npm audit` is run after every dependency change.
- **Targeted overrides:** when a vulnerable sub-dependency has a patched release that upstream packages have not adopted yet, an npm `overrides` entry pins the patched version. Each override is reviewed and removed once upstream catches up.

### Repository

- **Secret protection:** the `.gitignore` blocks environment files, credentials, tokens, SSH keys, certificates, cloud provider configs, GPG keys and keyrings, and YubiKey exports, PINs, and recovery codes.
- **Consistent line endings and binary handling** through `.gitattributes`, preventing accidental file corruption.

---

## Signed Commits (GPG and YubiKey)

Maintainers are encouraged to sign every commit and tag, so each change can be verified as authentic.

### Configure Git to Sign

```bash
gpg --list-secret-keys --keyid-format=long
git config --global user.signingkey <YOUR_KEY_ID>
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```

On Windows with Gpg4win, Git may also need the path to GPG:

```bash
git config --global gpg.program "C:/Program Files (x86)/GnuPG/bin/gpg.exe"
```

### Using a YubiKey

When the signing key is stored on a YubiKey, the private key never leaves the hardware. Confirm the card is detected:

```bash
gpg --card-status
```

Git will then ask for the YubiKey PIN (and a touch, if touch policy is enabled) whenever it signs.

### Verify Signatures

```bash
git log --show-signature -1
git verify-commit HEAD
```

### Key Safety

- Never commit private keys, keyrings, revocation certificates, or YubiKey PINs, PUKs, management keys, or recovery codes.
- Store backups and recovery codes in a password manager or offline secure storage.
- If a key is ever exposed, revoke it immediately and publish the revocation.

---

## Maintainer Checklist

Before every commit:

```bash
npm run format && npm run check
git status
```

Before every release:

```bash
npm audit
npm outdated
npm run build
```

- Review `git status` to confirm no secrets or unexpected files are staged.
- Review any `npm audit` findings before releasing.
- Update dependencies deliberately, one change at a time, and re-run the full check.
- If a secret is ever committed, remove it with `git rm --cached <file>` and **rotate or revoke the secret immediately**. Removing it from the repository alone is not enough.
