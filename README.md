# Cloudflare Multi-Worker Boilerplate

A modern, production-ready boilerplate for building full-stack applications with Cloudflare Workers and Durable Objects. This template provides a solid foundation for developing scalable, serverless applications on the Cloudflare platform.

## Features

- 🚀 Monorepo structure for multiple workers and durable objects
- ⚡️ React Router for the web application
- 📦 TypeScript support across all packages
- 🔄 Pre-configured scripts for typegen and deployment
- 🔒 Environment variable management
- 🌐 D1 Database integration with Drizzle ORM
- 🧩 Durable Objects for stateful applications
- 🔍 Zod for schema validation
- 🎨 TailwindCSS for styling

## Technologies

### Core Technologies

- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)**: Serverless JavaScript runtime at the edge
- **[Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)**: Stateful serverless objects for coordination and persistence
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)**: Serverless SQL database built on SQLite

### Frontend

- **[React](https://react.dev/)**: UI library for building component-based interfaces
- **[React Router](https://reactrouter.com/)**: Declarative routing for React applications
- **[TailwindCSS](https://tailwindcss.com/)**: Utility-first CSS framework

### Database & Validation

- **[Drizzle ORM](https://orm.drizzle.team/)**: Lightweight TypeScript ORM with type safety
- **[Zod](https://zod.dev/)**: TypeScript-first schema validation

### Monorepo Management

- **[Turborepo](https://turborepo.com/)**: High-performance build system for JavaScript/TypeScript monorepos
- **[Bun](https://bun.sh/)**: Fast JavaScript runtime, bundler, test runner, and package manager

## Project Structure

```
cf-multiworker-boilerplate/
├── apps/                  # Web applications
│   └── web/               # Main web application (React Router)
│       ├── app/           # React application code
│       ├── db/            # Database schema and utilities
│       └── workers/       # Worker entry points
├── durable-objects/       # Durable Objects
│   └── example-do/        # Example Durable Object
├── packages/              # Shared packages
├── scripts/               # Utility scripts
│   ├── pre-typegen.ts     # Script for wrangler configuration
│   └── wrangler.ts        # Wrangler CLI wrapper
└── turbo.json             # Turborepo configuration
```

### Custom Configuration Scripts

The project includes custom scripts to streamline development and deployment:

#### pre-typegen.ts

This script automatically prepares the Wrangler configuration for different environments:

- Creates `wrangler.temp.json` for typegen by removing `script_name` from Durable Object bindings
- Creates `wrangler.dev.json` for development by adding migrations with Durable Object class names
- Uses `jsonc-parser` for proper JSONC handling
- Configured in `turbo.json` as a dependency for `cf-typegen` and `dev` tasks

This approach ensures consistent configuration across development and production environments.

## Database Schema

The boilerplate includes a generic database schema with the following tables:

- **Users**: Store application users with email and name
- **Items**: Generic items that can be customized for your application
- **Tags**: Categorization tags for items
- **Comments**: User comments on items

The schema is defined using Drizzle ORM and includes Zod validation schemas for type safety.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (>= 1.2.14)
- [Node.js](https://nodejs.org/) (>= 18)
- [Cloudflare Account](https://dash.cloudflare.com/sign-up)

### Installation

Install the dependencies:

```bash
bun install
```

### Environment Setup

Create a `.env.local` file in the root directory with your Cloudflare credentials:

```
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
SESSION_SECRET=your_session_secret
VALUE_FROM_CLOUDFLARE=example_value
```

For the web application, copy the example environment variables:

```bash
cd apps/web
cp .dev.vars.example .dev.vars
```

### Development

Start the development server:

```bash
bun run dev
```

This will start all the necessary services for development.

## Deployment

### Configuration

Before deploying, you need to configure your wrangler.jsonc files with your Cloudflare account details:

#### 1. Configure D1 Database (apps/web/wrangler.jsonc)

Create a D1 database in your Cloudflare dashboard and update the database_id in `apps/web/wrangler.jsonc`:

```bash
# Create a new D1 database
cd apps/web
bun wrangler d1 create cf-web-app-db
```

You'll receive a database ID in the output. Update the `database_id` field in `apps/web/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "cf-web-app-db",
    "database_id": "YOUR_DATABASE_ID", // Replace with your actual database ID
    "migrations_dir": "./drizzle/migrations"
  }
]
```

#### 2. Configure Durable Objects

The Durable Objects are already configured in the wrangler files, but you need to ensure that the `script_name` in the web app matches the name of your Durable Object worker:

- In `apps/web/wrangler.jsonc`, make sure the `script_name` in the Durable Object binding matches your Durable Object worker name:

```jsonc
"durable_objects": {
  "bindings": [
    {
      "name": "TestDo",
      "class_name": "TestDo",
      "script_name": "cf-example-do" // This should match the name in durable-objects/example-do/wrangler.jsonc
    }
  ]
}
```

### Deploying

Once configured, deploy all services to Cloudflare:

```bash
bun run deploy
```

This will deploy both the web application and the Durable Object to your Cloudflare account.

### Applying Migrations

After deployment, you need to apply the database migrations:

```bash
cd apps/web
bun wrangler d1 migrations apply cf-web-app-db
```

## Customizing the Boilerplate

### Adding a New Durable Object

1. Create a new directory in `durable-objects/`
2. Copy the structure from `example-do/`
3. Update the package.json and wrangler.jsonc files
4. Implement your Durable Object logic in `workers/app.ts`

### Adding a New Web Application

1. Create a new directory in `apps/`
2. Copy the structure from `web/`
3. Update the package.json and wrangler.jsonc files
4. Implement your web application

## Scripts

- `pre-typegen.ts`: Modifies wrangler configuration for different environments
  - Creates wrangler.temp.json for typegen (removes script_name from durable object bindings)
  - Creates wrangler.dev.json for development (adds migrations with durable object class names)

- `wrangler.ts`: A wrapper around the Wrangler CLI for easier command execution

## License

MIT
