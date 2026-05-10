# Ordering

An order management system for all general or commercial use.

Built with **Next.js 16** + **TypeScript** + **Tailwind CSS v4** + **Docker**.

## Features

### Customer Frontend (`/`)
- Browse menu with images, prices, descriptions, and categories
- Add items to cart with quantity selection
- Place orders with pickup time, address, contact, and notes
- Track order status via unique order ID

### Admin Panel (`/admin`)
- Secure login with password protection
- Dashboard with overview stats
- Menu management: add, edit, delete items with trilingual names/descriptions
- Set availability by date range and/or day of week
- Publish/unpublish items
- Order management: view all orders, accept or cancel orders

### Order Tracking (`/order/[id]`)
- View order details: items, total, status, pickup info
- Real-time status updates (Pending → Accepted / Cancelled)

### Internationalization
- English, Simplified Chinese (简体中文), Traditional Chinese (繁體中文)
- Language switcher in the navigation bar

### Technical Highlights
- No database required — all data persists in localStorage
- Docker multi-stage build for production deployment
- Responsive design (mobile + desktop)

## Getting Started

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker compose up -d --build
```

### Build

```bash
npm run build
npm start
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Storage | localStorage (browser) |
| Deployment | Docker (multi-stage) |
| Container | Node 20 Alpine |

## Admin Access

Default admin password is set during deployment. Ask the system administrator for the current password.
