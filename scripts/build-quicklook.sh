#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/macos/MarkPaneQL.xcodeproj"
BUILD_DIR="$ROOT_DIR/macos/build"
OUTPUT_DIR="$ROOT_DIR/assets/quicklook"
IDENTITY="Developer ID Application: Starfysh, LLC (A3KNB5VZH2)"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
HOST_ENTITLEMENTS="$ROOT_DIR/macos/MarkPaneQLHost/MarkPaneQLHost.entitlements"
EXT_ENTITLEMENTS="$ROOT_DIR/macos/MarkPaneQLExt/MarkPaneQLExt.entitlements"

xcodebuild -project "$PROJECT_PATH" -scheme MarkPaneQLHost -configuration Release -derivedDataPath "$BUILD_DIR" \
  -destination 'platform=macOS,arch=arm64' \
  CODE_SIGN_IDENTITY="Developer ID Application: Starfysh, LLC (A3KNB5VZH2)" \
  CODE_SIGN_KEYCHAIN="$HOME/Library/Keychains/login.keychain-db" > /dev/null

APP_PATH="$BUILD_DIR/Build/Products/Release/MarkPaneQLHost.app"
if [ ! -d "$APP_PATH" ]; then
  echo "MarkPaneQLHost.app not found at $APP_PATH" >&2
  exit 1
fi

EXT_PATH="$APP_PATH/Contents/PlugIns/MarkPaneQLExt.appex"
if [ ! -d "$EXT_PATH" ]; then
  echo "MarkPaneQLExt.appex not found at $EXT_PATH" >&2
  exit 1
fi

codesign --force --options runtime --timestamp \
  --entitlements "$EXT_ENTITLEMENTS" \
  --sign "$IDENTITY" --keychain "$KEYCHAIN" \
  "$EXT_PATH"

codesign --force --options runtime --timestamp \
  --entitlements "$HOST_ENTITLEMENTS" \
  --sign "$IDENTITY" --keychain "$KEYCHAIN" \
  "$APP_PATH"

rm -rf "$OUTPUT_DIR/MarkPaneQLHost.app.bundled"
cp -R "$APP_PATH" "$OUTPUT_DIR/MarkPaneQLHost.app.bundled"
