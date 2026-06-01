# example-percy-maestro-selfhosted

Example app demonstrating [Percy](https://percy.io) visual testing with [Maestro](https://maestro.mobile.dev/) on **self-hosted** (non-BrowserStack) devices — your local dev machine, a CI runner with a connected device, or any host where you run `maestro test` yourself.

> Running on **BrowserStack App Automate** instead? See [`example-percy-maestro`](https://github.com/percy/example-percy-maestro-app) — it covers the BS-hosted path, where the BS runner manages the Percy CLI lifecycle for you.

The repo ships two Android flows + two iOS flows:

| Flow | Platform | Demonstrates |
|---|---|---|
| `flows/screenshot.yaml` | Android | Basic 2-snapshot smoke test (launch + result) |
| `flows/regions.yaml` | Android | Coordinate region + element region (`resource-id`) |
| `flows/ios/launch.yaml` | iOS simulator | Basic 1-snapshot smoke test (Settings) |
| `flows/ios/regions.yaml` | iOS simulator | Element region (`id` selector — iOS-only) + cli#2248 port cascade |

All Android flows target the bundled Sample Calculator app (`resources/app/app-debug.apk`, `com.sample.browserstack.samplecalculator`). All iOS flows target stock `com.apple.Preferences` (Settings) — no `.ipa` to ship, no signing.

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | ≥ 14 | runs `@percy/cli` |
| `@percy/cli` | ≥ `1.32.0-beta.3` (recommended) | cli#2254 auto-injects `-e PERCY_SERVER` so you don't have to. Older CLIs work too — see [CLI compatibility](#cli-compatibility) below. |
| [Maestro](https://maestro.mobile.dev/getting-started/installing-maestro) | ≥ 2.0 (2.4.0 recommended for iOS) | the runtime your flows execute under |
| Xcode (iOS only) | full Xcode, not just CLT | required for `xcrun simctl` and iOS simulators |
| Android SDK Platform Tools | any modern | for `adb devices` |
| **`JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true`** (macOS hosts) | env var | **Load-bearing** — Maestro's bundled `dadb` library tries IPv6 loopback to adb by default on macOS, which silently times out. Forcing IPv4 lets the Android device-driver install path complete. Symptom without it: Maestro hangs at `Selected device <serial> using port <P>` with no further output for 3+ minutes. Affects iOS hosts too (the JVM is the same). |
| A [Percy](https://percy.io) project of type **App** | — | for the dashboard. `PERCY_TOKEN` should start with `app_…` |

---

## Step 1 — Clone and install

```bash
git clone https://github.com/percy/example-percy-maestro-selfhosted
cd example-percy-maestro-selfhosted
npm install
npm run sync-sdk
```

`npm install` installs `@percy/cli` as a devDependency. `npm run sync-sdk` clones `@percy/maestro-app` at the pinned tag (`v1.0.0-Beta.0`) and copies its `percy/` directory into `flows/percy/` so Maestro's `runFlow:` directives can find the sub-flows.

> **Why the separate `sync-sdk` step?** The SDK isn't on the npm registry yet (it ships as a GitHub release tag). Once the SDK is published to npm, this step collapses to `cp -r node_modules/@percy/maestro-app/percy ./flows/percy` — the same files end up in the same place either way.

---

## Step 2 — Export your Percy token + host env

```bash
export PERCY_TOKEN=app_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export PERCY_MAESTRO_SCREENSHOT_DIR="$PWD/.percy-out"
mkdir -p "$PERCY_MAESTRO_SCREENSHOT_DIR"

# macOS hosts: required for both Android and iOS Maestro runs
export JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true"
```

`PERCY_MAESTRO_SCREENSHOT_DIR` is where the SDK writes screenshot PNGs and where the CLI relay looks for them — set it consistently in your shell and Maestro will inherit it.

---

## Step 3 — Quickstart: Android

Attach a Pixel-class Android device (or boot an emulator) and confirm:

```bash
adb devices
# List of devices attached
# 28121FDH200GQM    device
```

Install the Sample Calculator app once:

```bash
adb install -r resources/app/app-debug.apk
```

Run the regions flow:

```bash
percy app:exec -- maestro test flows/regions.yaml
```

That's the whole quickstart. The CLI starts a local Percy server, `app:exec` auto-injects `-e PERCY_SERVER=http://localhost:5338` into the maestro command (cli#2254), Maestro runs your flow, the SDK uploads two snapshots, and the CLI finalizes a build.

**Expected output (abridged):**

```
[percy] Percy has started!
[percy] Running "maestro test -e PERCY_SERVER=http://localhost:5338 flows/regions.yaml"
[percy] Snapshot taken: Regions_coordinate
[percy] Snapshot taken: Regions_element
[percy] Finalized build #N: https://percy.io/<org>/<project>/builds/<id>
```

Open the build URL to see the snapshots. The coordinate region masks the top strip; the element region masks the calculator display.

---

## Step 4 — Quickstart: iOS (simulator)

Boot an iPhone simulator:

```bash
xcrun simctl list devices available | grep "iPhone 16"
# pick an available UDID, then:
xcrun simctl boot <udid>
open -a Simulator
```

Run the iOS regions flow:

```bash
percy app:exec -- maestro test flows/ios/regions.yaml
```

**Expected output (abridged):**

```
[percy] Snapshot taken: iOS_SettingsRoot
[percy:core:maestro-hierarchy] runIosHttpDump ok sid=none nodes=32
[percy:core:maestro-hierarchy] dump took <N>ms via maestro-http (self-hosted, port=7001, 32 nodes)
[percy] Snapshot taken: iOS_SettingsGeneral
[percy] Finalized build #N: https://percy.io/...
```

The `runIosHttpDump ok ... port=7001` line confirms the cli#2248 deterministic-port cascade hit on the first probe — that's the iOS element-region resolution working end-to-end.

> **Real-device iOS** (USB-attached iPhone or iPad) is supported by the CLI via the `PERCY_IOS_DRIVER_HOST_PORT` override flag, but isn't demoed here. See [percy-maestro's validation runbook](https://github.com/percy/percy-maestro-app/blob/main/docs/solutions/best-practices/2026-05-27-self-hosted-maestro-validation.md#ios--runtime-verify-items-for-the-next-validation) for the override pattern.

---

## Region coordinate space

Coordinates in `PERCY_REGIONS` are **native PNG pixels**, not logical points. Percy compares the actual screenshot PNG bit-by-bit; the mask must be in the same coordinate space as the PNG. Common devices:

| Device | Native PNG resolution (portrait) | `right` for full-width mask | Status bar height (px) |
|---|---|---|---|
| Pixel 7 / Pixel 10 (Android) | 1080 × 2400 / 2424 | `1080` | ~120 |
| Pixel 8 Pro (Android) | 1344 × 2992 | `1344` | ~150 |
| iPhone 16 / iPhone 16 Plus | 1179 × 2556 / 1290 × 2796 | `1179` / `1290` | ~180 |
| iPhone 13 / iPhone 14 (iOS) | 1170 × 2532 | `1170` | ~140 |
| iPad Air 13" (M3) | 2048 × 2732 | `2048` | ~100 |

> The SDK auto-masks the status bar and bottom nav-bar/home-indicator (PR #6 in `v1.0.0-Beta.0` — `statusBarHeight: 120` Android, `100` iOS), so you usually **don't need a manual coordinate region** for those. Specify manual regions only for in-content masking (dynamic text, timestamps, etc.).
>
> If you're seeing a status-bar diff anyway, your device's PNG resolution probably differs from the SDK defaults — add a coordinate region sized in native pixels for your specific device.

---

## Validation pattern — baseline + comparison

To confirm regions are *actually masking* (not just present in the payload), run the flow twice with different content that the region should hide:

1. **Run #1** — run `percy app:exec -- maestro test flows/regions.yaml`. A Percy build appears; open it in the Percy dashboard and click **Approve**.
2. **Run #2** — edit `flows/regions.yaml` snapshot 2 so the calculation differs (e.g., change `tapOn: "5"` to `tapOn: "9"` and `tapOn: "3"` to `tapOn: "9"` → result becomes 81 instead of 8). Re-run. The new build compares against your approved baseline. If your element region masks the calculator display correctly, the snapshot should show as **Unchanged** despite the visible difference inside the masked area.

Demo builds from prior validation (Android Pixel 10 / iOS iPhone 16 simulator) — useful as visual references:

- Android baseline (7×8=56, approved): https://percy.io/9560f98d/app/RegionsIos-3d2ab5a4/builds/50215463
- Android comparison (9×9=81, all Unchanged): https://percy.io/9560f98d/app/RegionsIos-3d2ab5a4/builds/50215516
- iOS simulator baseline: https://percy.io/9560f98d/app/RegionsIos-3d2ab5a4/builds/50259296
- iOS simulator comparison: https://percy.io/9560f98d/app/RegionsIos-3d2ab5a4/builds/50259572

> **Note:** Percy's API response fields `applied-regions: null` and `ignored-regions: []` on a snapshot are red herrings. Regions ARE applied; verify by inspecting the diff image directly — masked areas appear as solid blocks rather than highlighted-diff regions.

---

## CLI compatibility

| `@percy/cli` version | Behavior |
|---|---|
| `≥ 1.32.0-beta.3` *(recommended)* | `percy app:exec` auto-injects `-e PERCY_SERVER=http://localhost:5338` into `maestro test`. The Step 3/4 commands above work as-is. |
| `1.32.0-beta.2` | You must pass `-e PERCY_SERVER` explicitly. See the collapsible below. |
| `≤ 1.31.x` | Self-hosted Maestro is unsupported. Upgrade to `1.32.0-beta.3` or newer. |

<details>
<summary>Explicit <code>-e PERCY_SERVER</code> workaround for <code>@percy/cli 1.32.0-beta.2</code></summary>

```bash
percy app:exec -- maestro test \
  -e PERCY_SERVER=http://localhost:5338 \
  flows/regions.yaml
```

The flag must come **before** the flow file path so Maestro's flag parser picks it up. Same on iOS (`flows/ios/regions.yaml`).

If you use `--port` to run Percy on a non-default port, mirror it in the `-e` value:

```bash
percy app:exec --port 5339 -- maestro test \
  -e PERCY_SERVER=http://localhost:5339 \
  flows/regions.yaml
```

Maestro's GraalJS sandbox does not inherit the parent process's environment — that's why the env var has to be threaded through Maestro's own `-e` channel rather than just `export`ed.

</details>

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Maestro hangs at `Selected device <serial> using port <P>` for 3+ min | macOS Java's IPv6-loopback fight with `adb` | `export JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true` before running |
| `[percy] DISABLED — this build will have zero Percy screenshot coverage` (and no snapshots upload) | SDK can't reach the CLI server — `PERCY_SERVER` not threaded | Upgrade CLI to ≥ `1.32.0-beta.3` (auto-inject) **or** pass `-e PERCY_SERVER=http://localhost:5338` explicitly |
| Build finalizes with `Snapshot command was not called` | Same as above — SDK fell back to `http://percy.cli:5338` which doesn't resolve self-hosted | Same fix |
| `[percy] Element region not found: {…} — skipping` | The selector doesn't match anything in the live hierarchy at snapshot time | Verify the selector by running `maestro hierarchy --device <udid>` and grepping for the expected attribute. iOS supports only the `id` key. |
| Status bar still shows as a diff despite SDK auto-mask | Your device's status bar height differs from the SDK default | Add an explicit coordinate region for your device (see the [coordinate-space table](#region-coordinate-space)) |
| `npm run sync-sdk` fails with `Could not resolve host: github.com` | Behind a corporate proxy without git proxy config | Set `git config --global http.proxy …` or download the SDK tag manually and extract `percy/` into `flows/percy/` |
| Coordinate region appears to mask only part of the intended area | Logical-points-vs-native-pixels mismatch | Multiply your coords by the device's pixel-ratio (typically 2× or 3×). See the [coordinate-space table](#region-coordinate-space). |

For deeper troubleshooting, see [`percy-maestro-app`'s validation runbook](https://github.com/percy/percy-maestro-app/blob/main/docs/solutions/best-practices/2026-05-27-self-hosted-maestro-validation.md).

---

## Updating to a newer SDK release

The pinned SDK tag is set in `scripts/sync-sdk.sh`. To bump:

1. Edit `SDK_TAG` in `scripts/sync-sdk.sh` to the new release tag.
2. Run `npm run sync-sdk` — re-vendors `flows/percy/` from the new tag.
3. Run `npm run validate` — confirms the new SDK's sub-flows still parse cleanly.
4. Re-run the [validation pattern](#validation-pattern--baseline--comparison) to catch any behavior shifts in the new SDK.

---

## Future work

- **Real-device iOS** — `PERCY_IOS_DRIVER_HOST_PORT` override is documented in the validation runbook but not demoed here. Requires hardware.
- **Multi-device parallel run** — two `percy app:exec --port <N>` invocations sharing one `PERCY_PARALLEL_NONCE` merge into one Percy build. The mechanism works (validated in cli#2254 tests); a runnable demo isn't shipped here because it requires ≥ 2 attached devices.
- **CI integration recipes** (GitHub Actions, GitLab CI, CircleCI) — the CI workflow in this repo only YAML-lints; a real CI demo needs an emulator/simulator step that's nontrivial to set up reliably in cloud runners.

---

## References

- [`@percy/cli`](https://github.com/percy/cli) — Percy command-line interface
  - [#2248](https://github.com/percy/cli/pull/2248) — relay file-find without `sessionId` + iOS port cascade
  - [#2254](https://github.com/percy/cli/pull/2254) — `app:exec` auto-injects `-e PERCY_SERVER` for `maestro test`
- [`@percy/maestro-app`](https://github.com/percy/percy-maestro-app) — the SDK this repo vendors
  - [Release v1.0.0-Beta.0](https://github.com/percy/percy-maestro-app/releases/tag/v1.0.0-Beta.0)
  - [Self-hosted validation runbook](https://github.com/percy/percy-maestro-app/blob/main/docs/solutions/best-practices/2026-05-27-self-hosted-maestro-validation.md)
- [Maestro docs](https://maestro.mobile.dev/) — flow YAML reference + CLI usage
- [Percy docs](https://docs.percy.io/) — visual testing concepts and dashboard usage
