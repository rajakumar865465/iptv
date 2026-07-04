# NivaTV

Flutter mobile app for NivaTV — premium live TV for Indian channels.

The backend URL is **not** hardcoded. It must be supplied at build time via
`--dart-define=BACKEND_URL=...`. If it is missing, the app boots into a
configuration-error screen telling the developer how to rebuild it, and
release builds are blocked entirely (see `android/app/build.gradle.kts`).

Production backend: `http://35.154.128.217`

## Build & run

### Local phone testing (real Android device over Wi-Fi)

The phone cannot reach `localhost` on your PC. Use your **PC's Wi-Fi IPv4**
address (run `ipconfig` on Windows and look under "Wireless LAN adapter" /
"Wi-Fi").

```bash
flutter run --debug --dart-define=BACKEND_URL=http://192.168.1.25:5000
```

Or use the helper script from the repo root, which auto-detects your Wi-Fi
IPv4:

```powershell
./run_local.ps1
```

> Make sure your phone and PC are on the **same Wi-Fi network**, and that
> the backend on your PC is listening on `0.0.0.0:5000` (not only `127.0.0.1`)
> and that the Windows Firewall allows inbound connections on port 5000.

### Android emulator

The emulator reaches the host PC at `10.0.2.2`:

```bash
flutter run --debug --dart-define=BACKEND_URL=http://10.0.2.2:5000
```

### Production APK (backend server)

```bash
flutter build apk --release --dart-define=BACKEND_URL=http://35.154.128.217
```

Or use the helper script:

```powershell
./build_release.ps1 -BackendUrl http://35.154.128.217
```

The release build will **fail** in Gradle if `BACKEND_URL` is not supplied,
so an APK can never ship pointing at a blank backend.

## URLs

- **Production backend:** `http://35.154.128.217`
- **Local phone test:** `http://<your-pc-wifi-ipv4>:5000`
- **Emulator:** `http://10.0.2.2:5000`

Never commit a real URL into source — always pass it via `--dart-define` (or a
CI secret for release builds).
