# Autowatch

Autowatch is a tiny Expo app I vibecoded in a day to make gym planks easier to time. It is a high-contrast stopwatch with an optional voice-controlled auto mode, so you can say "start" and "stop" without reaching for your phone mid-set.

## What it does

- Large, readable plank timer
- Manual start, stop, and reset controls
- Auto Mode for voice commands
- Haptic feedback for timer actions
- Minimal black-and-white UI for gym lighting
- Runs on Android, iOS, and web through Expo

## Tech stack

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router
- NativeWind / Tailwind CSS
- expo-speech-recognition
- expo-haptics

Expo SDK 54 expects Node.js 20.19.x or newer in the 20.x line.

## Getting started

Install dependencies:

```bash
npm install
```

Start the Expo dev server:

```bash
npm run dev
```

Then press:

- `a` for Android
- `i` for iOS on macOS
- `w` for web

Voice recognition uses a native module. For the best Auto Mode testing, run a development build on device or emulator instead of only relying on Expo Go.

## Scripts

```bash
npm run dev
npm run android
npm run ios
npm run web
```

## What to commit

Commit these project files and folders:

- `app/`
- `assets/`
- `components/`
- `lib/`
- `app.json`
- `babel.config.js`
- `components.json`
- `global.css`
- `metro.config.js`
- `nativewind-env.d.ts`
- `package.json`
- `package-lock.json`
- `tailwind.config.js`
- `tsconfig.json`
- `.gitignore`
- `.npmrc`
- `.prettierrc`
- `README.md`

Optional:

- `screenshots/` if you want GitHub visitors to see the app
- `bun.lock` only if you plan to use Bun as the package manager

Do not commit generated folders such as `node_modules/`, `.expo/`, build outputs, local logs, or native build caches.

## Notes

This app includes microphone and speech-recognition permission text in `app.json` for voice commands.
