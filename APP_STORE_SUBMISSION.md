# Mac App Store Submission Guide

## Prerequisites

- [x] Apple Developer Program membership (Starfysh, LLC - A3KNB5VZH2)
- [x] Code signing certificate (Developer ID Application)
- [ ] Mac App Store distribution certificate
- [ ] Mac App Store provisioning profile

## Step 1: Create Certificates & Profiles in App Store Connect

### 1.1 Create Mac App Store Distribution Certificate

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click "+" to create new certificate
3. Select "Mac App Distribution"
4. Follow CSR creation process
5. Download and install certificate in Keychain

### 1.2 Create App ID

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click "+" to register new App ID
3. Select "App IDs" → "macOS"
4. Bundle ID: `com.markpane.app`
5. Description: "MarkPane - Markdown Viewer"
6. Capabilities:
   - App Groups (enable and create `group.com.markpane.app`)

### 1.3 Create Provisioning Profile

1. Go to https://developer.apple.com/account/resources/profiles/list
2. Click "+" to create new profile
3. Select "Mac App Store" → "macOS"
4. Select App ID: `com.markpane.app`
5. Select Mac App Store distribution certificate
6. Download as `embedded.provisionprofile`
7. Place in `build/embedded.provisionprofile`

## Step 2: Create App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+"
3. Fill in details:
   - **Name:** MarkPane
   - **Bundle ID:** com.markpane.app
   - **SKU:** MARKPANE-001
   - **Primary Language:** English (U.S.)

### 2.1 Pricing & Availability

- **Price:** $19.99 (Price Tier 20)
- **Availability:** All territories
- **Promo Codes:** Enable (Apple provides 100 promo codes per version)

### 2.2 App Information

- **Category:** Developer Tools
- **Subcategory:** (Optional)
- **Copyright:** © 2026 Starfysh, LLC
- **Privacy Policy URL:** (Required - create and host)
- **Support URL:** (Required - create and host)

### 2.3 App Description

**Suggested Description:**

```
MarkPane - The Modern Markdown Viewer for macOS

MarkPane is a beautiful, lightweight markdown viewer designed for developers and writers who want a clean, distraction-free reading experience.

FEATURES:
• Instant markdown rendering with live preview
• Full support for mermaid diagrams (flowcharts, sequence diagrams, etc.)
• Syntax highlighting for code blocks
• Quick Look extension - preview .md files in Finder
• Native macOS design with dark mode support
• Fast and lightweight - built with Electron
• No subscriptions - pay once, use forever

PERFECT FOR:
• Viewing documentation files (README.md, CHANGELOG.md)
• Reading technical notes and project wikis
• Previewing markdown before committing to Git
• Reviewing pull request descriptions

TECHNICAL FEATURES:
• markdown-it parser with task list support
• Mermaid.js for diagram rendering
• Highlight.js for syntax highlighting
• DOMPurify for security
• Supports GitHub Flavored Markdown

MarkPane turns your Mac into the perfect markdown reading companion.
```

**Keywords:** markdown, viewer, mermaid, diagrams, developer, documentation, readme, preview, syntax highlighting, github

### 2.4 Screenshots Required

Create screenshots at required resolutions:
- **13.3" Display (2560 x 1600)** - 1-10 screenshots
- **Optional:** Additional display sizes

Recommended screenshots:
1. Main window showing rendered markdown
2. Dark mode view
3. Mermaid diagram rendering
4. Quick Look preview in Finder
5. Syntax highlighting example

### 2.5 App Preview Video (Optional)

30-second demo showing:
1. Opening a markdown file
2. Viewing rendered content
3. Mermaid diagram animation
4. Quick Look in Finder

## Step 3: Build for Mac App Store

```bash
# Build MAS version
yarn build:mas

# Output will be in: dist/mas/MarkPane.pkg
```

## Step 4: Upload to App Store Connect

### Option 1: Using Transporter (GUI)
1. Download Transporter from Mac App Store
2. Open `dist/mas/MarkPane.pkg`
3. Click "Deliver"

### Option 2: Using Command Line
```bash
xcrun altool --upload-app \
  --type macos \
  --file dist/mas/MarkPane.pkg \
  --username your-apple-id@email.com \
  --password @keychain:AC_PASSWORD
```

## Step 5: Submit for Review

1. Go to App Store Connect → MarkPane → "Prepare for Submission"
2. Select the uploaded build
3. Fill in:
   - Export Compliance Information (if applicable)
   - Content Rights
   - Advertising Identifier (No)
4. Add reviewer notes (if needed)
5. Click "Submit for Review"

## Step 6: Promo Codes Setup

After approval:
1. App Store Connect → MarkPane → "Promo Codes"
2. Request codes (100 per version)
3. Distribute discount codes to users

## Review Timeline

- Initial review: 1-3 days typically
- Updates: 24-48 hours typically

## Post-Approval

- Monitor crash reports in App Store Connect
- Respond to user reviews
- Plan updates and improvements

## Notes

- Quick Look extension may require additional entitlements review
- First submission may take longer due to account verification
- Keep provisioning profiles up to date (expire after 1 year)
