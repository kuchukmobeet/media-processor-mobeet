# Mobeet Media Processor

A **clean and minimal** Express.js TypeScript API for media processing with proper project structure.

## ✨ Features

- **TypeScript**: Full type safety with clean organization
- **Express.js**: Well-structured web framework setup
- **Clean Architecture**: Proper separation of concerns
- **Health Checks**: Essential health endpoint
- **Security**: Helmet.js for headers
- **CORS**: Cross-origin support
- **Simple**: No over-engineering or unnecessary complexity

## 📁 Clean Structure

```
mobeet-media-processor/
├── src/
│   ├── config/           # Simple configuration
│   │   └── index.ts
│   ├── controllers/      # Clean request handlers
│   │   ├── healthController.ts
│   │   └── mediaController.ts
│   ├── middleware/       # Essential middleware only
│   │   └── errorHandler.ts
│   ├── routes/          # Route definitions
│   │   ├── health.ts
│   │   └── media.ts
│   ├── services/        # Business logic
│   │   └── mediaService.ts
│   ├── types/           # TypeScript definitions
│   │   └── index.ts
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server startup
├── dist/                # Compiled JavaScript
├── .env.example         # Environment variables
├── package.json
├── tsconfig.json
└── README.md
```

Well-organized, but **simple**.

## 🛠️ Setup

### Prerequisites

- Node.js 24 (specified in `.nvmrc`)
- npm or yarn
- nvm (recommended for Node version management)

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd mobeet-media-processor
   ```

2. **Use the correct Node.js version (if using nvm):**
   ```bash
   nvm use
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Build the project:**
   ```bash
   npm run build
   ```

## 🏃 Quick Start

```bash
npm install
npm run build
npm run dev
```

### Scripts

- `npm run dev` - Development with auto-reload
- `npm run build` - Compile TypeScript
- `npm start` - Run production build
- `npm run clean` - Clean build files

## 📡 API Endpoints

- `GET /` - API info
- `GET /health` - Health check
- `POST /api/media/process` - Process media (needs `inputUrl`)
- `GET /api/media/jobs` - List all jobs
- `GET /api/media/jobs/:id` - Get specific job

### Quick Test

```bash
# Health check
curl http://localhost:3000/health

# Create job
curl -X POST http://localhost:3000/api/media/process \
  -H "Content-Type: application/json" \
  -d '{"inputUrl": "https://example.com/video.mp4"}'

# List jobs
curl http://localhost:3000/api/media/jobs
```

## ⚙️ Environment Variables

Optional `.env` file:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
```

## 🔧 How It Works

- **`config/`**: Simple environment configuration
- **`controllers/`**: Clean request handlers
- **`middleware/`**: Essential error handling
- **`routes/`**: Organized API endpoints
- **`services/`**: Business logic layer
- **`types/`**: TypeScript interfaces
- **In-memory storage**: Jobs stored in array (add database later)

## 🚀 Adding Features

1. Add types to `types/index.ts`
2. Add business logic to `services/`
3. Add controllers to `controllers/`
4. Add routes to `routes/`
5. Register routes in `app.ts`

---

**Clean and simple! 🚀**
