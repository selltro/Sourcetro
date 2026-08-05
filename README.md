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
- Flat-lay clothing measurements
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
- One-click switching between Personal Mode and the complete SourceTro product; both modes share the same scans and inventory, so no work is erased

## Important product boundary

This is the working front-end foundation. It stores listing, sourcing, membership-interest, and Tell Tro feedback data in the browser. The Smart Source Scan currently produces a clearly labeled planning estimate so the complete workflow can be tested. Live web comparisons, real visual identification, cloud feedback delivery, direct publishing, live orders, automatic delisting, marketplace analytics, payment information, and real AI generation require secure backend services and approved marketplace/API connections.

## Run locally

No build step is required. Serve the folder with any static server, for example:

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000`.

## Deployment

The included GitHub Actions workflow deploys the site to GitHub Pages after each push to `main`. Pages is enabled and configured to use GitHub Actions.
