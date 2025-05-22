# Cloudflare Multi-Worker Web App

A modern, production-ready boilerplate for building full-stack React applications with Cloudflare Workers and Durable Objects.

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
bun install
```

### Environment Setup

Copy the example environment variables file to create your local development variables:

```bash
cp .dev.vars.example .dev.vars
```

Then edit `.dev.vars` to add your development API keys and other environment variables.

### Development

Start the development server with HMR:

```bash
bun run dev
```

Your application will be available at `http://localhost:5173`.

## Previewing the Production Build

Preview the production build locally:

```bash
bun run preview
```

## Building for Production

Create a production build:

```bash
bun run build
```

## Managing Secrets and Environment Variables

### Local Development

For local development, environment variables are stored in the `.dev.vars` file, which is not committed to the repository. This file is loaded automatically when running `bun run dev`.

### Production Deployment

For production, use Wrangler secrets to securely store sensitive information:

```bash
wrangler secret put API_KEY
```

This command will prompt you to enter the secret value, which will be securely stored in Cloudflare's infrastructure and made available to your Worker at runtime.

## Deployment

Deployment is done using the Wrangler CLI.

To build and deploy directly to production:

```sh
npm run deploy
```

To deploy a preview URL:

```sh
npx wrangler versions upload
```

You can then promote a version to production after verification or roll it out progressively.

```sh
npx wrangler versions deploy
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
