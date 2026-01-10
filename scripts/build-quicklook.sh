#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/macos/PeekdownQL.xcodeproj"
BUILD_DIR="$ROOT_DIR/macos/build"
OUTPUT_DIR="$ROOT_DIR/assets/quicklook"

xcodebuild -project "$PROJECT_PATH" -scheme PeekdownQLHost -configuration Release -derivedDataPath "$BUILD_DIR" \
  -destination 'platform=macOS,arch=arm64' \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" > /dev/null

APP_PATH="$BUILD_DIR/Build/Products/Release/PeekdownQLHost.app"
if [ ! -d "$APP_PATH" ]; then
  echo "PeekdownQLHost.app not found at $APP_PATH" >&2
  exit 1
fi

rm -rf "$OUTPUT_DIR/PeekdownQLHost.app"
cp -R "$APP_PATH" "$OUTPUT_DIR/PeekdownQLHost.app"
