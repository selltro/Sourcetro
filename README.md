# SourceTro

**From Source to Sold** — a calm, guided resale workspace built for resellers.

**Mission:** SourceTro helps resellers source smarter, list faster, stay organized, and sell more.

**Tro™** means **Trusted Resale Operator**.

## Live app

Open SourceTro at: https://selltro.github.io/Sourcetro/

## Included in this build

- Lens-based SourceTro branding
- Smart Source Scan with photo capture, item details, planning comparisons, estimated sold range, profit, ROI, demand, maximum buy price, and buy/consider/pass guidance
- TroFit profile for personal budget, profit, time, storage, experience, speed, and marketplace preferences
- Personal TroScore with transparent profit, cash, speed, space, and marketplace factors
- Best-marketplace preview, Offer Guide, and photo-based Authenticity Risk Review
- SourceTro Batch Scan queue, barcode/model-number clue entry, and Photo Prep entry point
- One-tap handoff from a sourcing decision into the listing creator
- Responsive desktop and mobile dashboard
- Five-step listing creator
- Multi-photo preview and photo improvement choices
- Tro Measure guided photo flow: add up to two straight-down clothing photos with a visible measuring tape, automatically fill supported flat-lay measurements, and clearly flag values that need seller review
- Typed or browser voice input
- Tro-generated title, description, measurements, and pricing range
- eBay, Poshmark, Mercari, and Depop listing preparation
- Inventory, SKU, and storage-bin tracking
- Orders and shipping workspaces
- Analytics and profit estimator
- Tro resale assistant drawer
- Free, Source ($9.99), Seller ($24.99), and Pro ($39.99) membership comparison with monthly and annual pricing
- Tell Tro feedback, screenshot attachment, voice entry, customer roadmap, and voting
- Browser storage and installable PWA support
- Personal Mode for Nydia and Budget Basket, with a simplified source-to-profit dashboard, Tro Today tasks, dead-pile progress, and a connection checklist
- Resale Workbench with separate "thinking of buying" and "already own it" paths, one-click eBay sold-search research, user-verified comparison ranges, sourcing-place tracking, and no-repeat handoff into the listing creator
- SourceTro SEO Check with a transparent listing score, missing-detail guidance, buyer-search checklist, and a selling plan for marketplace, price, timing, and source performance
- Secure Cloudflare Worker connection for live OpenAI photo analysis, item identification, comparison keywords, details-to-verify, and AI-written SEO listing drafts
- Owner-key protection stored only for the current browser tab; the OpenAI API key remains encrypted in Cloudflare and never enters the public app
- One-click switching between Personal Mode and the complete SourceTro product; both modes share the same scans and inventory, so no work is erased

## Memory protection

SourceTro includes a lightweight memory guard for photo-heavy workflows. AI image preparation is serialized so two large camera photos are not decoded and resized at the same time, the Batch Scan queue is capped at eight active photos, selected batch photos are removed from the queue after handoff, and a Clear batch photos control releases queued browser blob URLs. These safeguards reduce memory spikes on phones and long-running browser sessions without lowering Tro Measure's 1400-pixel analysis resolution.

## Important product boundary

This build stores listing, sourcing, membership-interest, and Tell Tro feedback data in the browser. Personal Mode can securely send item photos to the owner-protected Cloudflare Worker for OpenAI analysis and listing writing. Sold-price evidence still comes from the seller's verified eBay search until the approved eBay API is connected. Direct publishing, live orders, automatic delisting, marketplace analytics, cloud accounts, and payment information require additional approved services.

## Run locally

No build step is required. Serve the folder with any static server, for example:

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000`.

## Deployment

The included GitHub Actions workflow deploys the site to GitHub Pages after each push to `main`. Pages is enabled and configured to use GitHub Actions.