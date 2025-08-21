# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a high-performance Node.js media processing service that applies Instagram story-like filters, overlays stickers and text, and outputs optimized images or videos. The service uses **FFmpeg** for media manipulation with a clean layered architecture following SOLID principles.

## Key Development Commands

### Setup and Build
```bash
# Use correct Node.js version
nvm use

# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Start production server
npm run start

# Start development server with hot reload
npm run dev

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check

# Clean build artifacts
npm run clean
```

### Testing API Endpoints
```bash
# Health check
curl http://localhost:8000/health

# Test image processing
curl -v \
  --form "file=@uploads/test.png" \
  --form-string 'metadata={"post": false, "mediaType": "image", "background": {"aspectRatio": "9:16", "color": "#000000"}, "content": {"position": {"x": 0, "y": 0}, "size": {"width": 1080, "height": 1920}, "rotation": 0}, "filters": {"ffmpeg": "curves=all='\''0/0.05 0.3/0.25 0.7/0.8 1/1'\'''"}, "output": {"quality": 90}}' \
  http://localhost:8000/process

# List available stickers
curl http://localhost:8000/stickers

# List available fonts
curl http://localhost:8000/fonts
```

### Required External Dependencies
- **FFmpeg** CLI available in PATH
- **Node.js** (version specified in .nvmrc)

### Environment Variables
Key variables in `.env`:
- `VIDEO_ENCODER`: Set to "nvenc" for GPU acceleration, otherwise uses CPU
- `MEDIA_OUTPUT_DIR`, `MEDIA_UPLOAD_DIR`, `MEDIA_ASSETS_DIR`: Directory paths

## Architecture Overview

### Clean Architecture Layers

The application follows clean architecture principles with clear separation of concerns:

**Controllers** (`src/controllers/`)
- Handle HTTP requests/responses
- Input validation and error handling
- Coordinate between services

**Services** (`src/services/`)
- Business logic orchestration
- File management and asset resolution
- Media processing coordination

**Processors** (`src/processors/`)
- Core FFmpeg processing logic
- Specialized image and video handlers
- Filter graph construction

**Types & Validators** (`src/types/`, `src/validators/`)
- TypeScript interfaces and types
- Zod schema validation
- Request/response contracts

**Middleware** (`src/middleware/`)
- Error handling and logging
- Request/response processing
- Security and validation

### Processing Pipeline

1. **Request Reception**: Express controller receives multipart upload
2. **Input Validation**: Zod schema validation of metadata
3. **Asset Resolution**: Resolve sticker/font paths from server assets
4. **Media Processing**: Direct FFmpeg processing (no queuing)
5. **File Management**: Automatic cleanup of temporary files
6. **Response**: Return processed file URL and metadata

### Key Data Flow

```
Client Upload → Controller → Validator → Service → Processor (FFmpeg) → Response
```

### Canvas System
- **Stories/Reels**: 1080×1920 (9:16 aspect ratio)
- **Posts**: 1080×1350 (4:5 aspect ratio)  
- Controlled via `meta.post` boolean flag

### Content Layers (Z-order)
1. **Background**: Solid color canvas
2. **Main Content**: Input image/video with optional crop, rotation, scale
3. **Stickers**: PNG/WebP overlays with position, rotation, opacity
4. **Text**: TTF-rendered text with configurable fonts, colors, backgrounds

### Filter System
Raw FFmpeg filter strings passed directly to workers:
- `filters.ffmpeg`: Custom filter chain (e.g., `"curves=all='0/0 1/1',hue=s=1.2"`)
- Applied after geometric transforms, before sticker/text overlays

## File Structure Guide

```
src/
├── app.ts                      # Main Express application entry point
├── config/
│   └── index.ts                # Configuration management
├── controllers/
│   └── mediaController.ts      # HTTP request handlers
├── services/
│   ├── mediaService.ts         # Core business logic
│   └── assetService.ts         # Asset management (stickers/fonts)
├── processors/
│   ├── baseProcessor.ts        # Shared FFmpeg processing logic
│   ├── imageProcessor.ts       # Image-specific processing
│   └── videoProcessor.ts       # Video-specific processing
├── middleware/
│   ├── errorHandler.ts         # Global error handling
│   └── requestLogger.ts        # Request logging
├── validators/
│   └── media.ts                # Zod schemas for input validation
├── types/
│   ├── media.ts                # Media processing types
│   └── http.ts                 # HTTP request/response types
└── utils/
    ├── geometry.ts             # Canvas and positioning utilities
    ├── file.ts                 # File system operations
    └── color.ts                # Color conversion utilities

uploads/                        # Temporary upload storage
outputs/                        # Processed media files
assets/
├── stickers/                   # .webp/.png sticker files
├── fonts/                      # .ttf font files  
└── luts/                       # (Reserved for future LUT support)
```

## FFmpeg Integration Details

### Input Handling
- Lavfi color generator for canvas background
- Multiple input streams: canvas, main content, stickers
- Looped sticker inputs for video processing

### Filter Graph Architecture
- Complex filter graphs with named intermediate outputs
- Geometric transforms → Filters → Overlays → Encoding
- Precise overlay positioning with decimal coordinate support

### Encoding Profiles
**Images**: MJPEG with quality mapping
**Videos**: 
- Primary: H.264 with NVENC (GPU)
- Fallback: libx264 (CPU)
- 60fps CFR output, faststart flag for web streaming

## Development Patterns

### Schema-First Design
All API inputs validated against Zod schemas with defaults. Extend `src/validators/media.ts` for new features.

### Error Handling Strategy
- Global error middleware catches and formats all errors
- Automatic temp file cleanup in finally blocks
- NVENC → libx264 → libx264+AAC fallback chain for video encoding
- 10-minute processing timeouts
- Structured error logging with Pino

### Asset Management
- Server-side only stickers/fonts (no user uploads)
- Path traversal protection in asset resolution
- Graceful fallbacks for missing assets
- Asset listing endpoints for discovery

### Service Layer Pattern
- Clear separation between HTTP handling and business logic
- Services coordinate between different processors
- Dependency injection for testability
- Single responsibility principle throughout layers
