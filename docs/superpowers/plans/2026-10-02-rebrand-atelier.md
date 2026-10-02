# Rebrand Site to Atelier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Rebrand the entire atelier.video website to **Atelier** (Free UI Open Source site). Preserve the exact layout, structure, color scheme, typography, and styling, performing a precise 1:1 replacement of all branding, logos, copy, metadata, and data sources.

---

### File Inventory & Scope

- **HTML Pages (22+ files)**: `index.html`, `blocks.html`, `explore.html`, `product.html`, `pricing.html`, `blog.html`, `docs.html`, `login.html`, `contact.html`, `templates.html`, `projects.html`, `terms.html`, `privacy.html`, etc.
- **Logos & Vector Assets**:
  - Main header & sidebar logo: `AtelierLogoV2` inline SVG in HTML and in JS bundles (`js/3843-*.js`, `js/5309-*.js`, `js/7700-*.js`).
  - Giant footer glow logo: `marketing-assets/images/footer-logo.svg`, `images/footer-logo.b54e7.svg`.
- **Icons & Manifests**:
  - `favicons/favicon.ico`, `favicons/favicon-96x96.png`, `images/favicon-96x96.9b324.png`, `images/favicon.9b324.ico`, `assets/site.9b324.webmanifest`.
- **JavaScript Client Bundles**:
  - `js/_app-9b4c32d9efde4efe.44c10.js`
  - `js/3843-7bb8c269c353f7d7.48c3b.js`
  - `js/5309-45eda456af8993ac.48c3b.js`
  - `js/7700-3f22f95a8f6b4750.48c3b.js`
  - `js/4997-576ec25e4fc489b3.48c3b.js`
- **Data & API Cache**:
  - `api_cache/*.json`
  - `serve.js` (header / proxy / fallback handling)

---

### Task 1: Create Atelier Vector Logos & Brand Assets

- [ ] **Step 1**: Design the **Atelier** primary wordmark SVG matching the exact dimensions, cursive/script fluid curves or exact typographic weight of the original Atelier logo (`viewBox="0 0 107 23"` or proportional SVG) with role `img` and `aria-label="Atelier"`.
- [ ] **Step 2**: Create the **Atelier** footer glow logo SVG (`1867×800`) replacing `marketing-assets/images/footer-logo.svg` and `images/footer-logo.b54e7.svg` with the identical glowing neon filter stack (`#filter0_f_1384_7266`).
- [ ] **Step 3**: Update the app manifest `assets/site.9b324.webmanifest` and favicons to Atelier.

---

### Task 2: Rebrand All HTML Pages & Metadata

- [ ] **Step 1**: Write a script to update all `.html` files in the repository:
  - Replace `<title>Atelier ...</title>` with `<title>Atelier ...</title>`
  - Replace `aria-label="Atelier"` with `aria-label="Atelier"`
  - Replace logo SVG paths with the Atelier SVG wordmark
  - Replace `Atelier Studio` with `Atelier Studio`
  - Replace `Atelier Blocks` with `Atelier Blocks`
  - Replace `atelier.video` with `atelier.design`
  - Replace `© Atelier` with `© Atelier`
  - Replace OpenGraph and Twitter card metadata
- [ ] **Step 2**: Run the script across all 22+ HTML pages.
- [ ] **Step 3**: Verify HTML files contain zero broken tags or syntax issues.

---

### Task 3: Update JavaScript Bundles & React Components

- [ ] **Step 1**: Update `AtelierLogoV2` in `js/3843-*.js`, `js/5309-*.js`, and `js/7700-*.js` to render the Atelier wordmark path and `aria-label="Atelier"`.
- [ ] **Step 2**: Update brand text occurrences in `js/` bundles (`"Atelier Studio"` -> `"Atelier Studio"`, `"Atelier Blocks"` -> `"Atelier Blocks"`, `"Atelier"` -> `"Atelier"`).
- [ ] **Step 3**: Verify JS bundle syntax (`node -c`).

---

### Task 4: Rebrand Cached API Payloads & Server Middleware

- [ ] **Step 1**: Update `api_cache/*.json` to replace `"Atelier Studio"` and `"atelier"` workspace/creator identifiers with `"Atelier Studio"` and `"atelier"`.
- [ ] **Step 2**: Ensure `serve.js` rewrites/serves any lingering dynamic requests with Atelier branding.

---

### Task 5: Comprehensive Live Verification

- [ ] **Step 1**: Inspect the home page (`http://localhost:3000/`) with Playwright: verify header logo, hero text, and footer.
- [ ] **Step 2**: Inspect the blocks page (`http://localhost:3000/blocks`): verify drawer, block creator, and download button JSON payload.
- [ ] **Step 3**: Take screenshots of Header, Footer, and Blocks page to confirm visual perfection.
