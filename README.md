# SourceTro

**From Source to Sold** — a calm, guided resale workspace built for resellers.

**Mission:** SourceTro helps resellers source smarter, list faster, stay organized, and sell more.

**Tro™** means **Trusted Resale Operator**.

## Live app

Open SourceTro at: https://selltro.github.io/Sourcetro/

## Included in this build

- Lens-based SourceTro branding
- Smart Source Scan with photo capture, item details, planning comparisons, estimated sold range, profit, ROI, demand, maximum buy price, and buy/consider/pass guidance
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
- Browser storage and installable PWA support

## Important product boundary

This is the working front-end foundation. It stores listing and sourcing data in the browser. The Smart Source Scan currently produces a clearly labeled planning estimate so the complete workflow can be tested. Live web comparisons, real visual identification, direct publishing, live orders, automatic delisting, marketplace analytics, payment information, and real AI generation require secure backend services and approved marketplace/API connections.

## Run locally

No build step is required. Serve the folder with any static server, for example:

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000`.

## Deployment

The included GitHub Actions workflow deploys the site to GitHub Pages after each push to `main`. Pages is enabled and configured to use GitHub Actions.
