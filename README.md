# SourceTro

**From Source to Sold** — a calm, guided resale workspace built for clothing-first sellers.

## Included in this build

- Lens-based SourceTro branding
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

This is the working front-end foundation. It stores listing data in the browser. Direct publishing, live orders, marketplace analytics, payment information, and real AI generation require secure backend services and approved marketplace/API connections.

## Run locally

No build step is required. Serve the folder with any static server, for example:

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000`.

## Deployment

The included GitHub Actions workflow deploys the site to GitHub Pages after each push to `main` once Pages is enabled for the repository.
