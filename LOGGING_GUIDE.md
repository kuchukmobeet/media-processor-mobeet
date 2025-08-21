# Logger Usage Guide

This document explains how to use the centralized logging system in the media processor application.

## Overview

The application uses **Pino** for structured logging with a centralized logger configuration located in `src/utils/logger.ts`. This provides consistent logging across all components with proper log levels, formatting, and development-friendly output.

## Quick Start

```typescript
import { loggers, logUtils } from '../utils/logger';

// Use specific loggers for different components
loggers.service.info('Service operation completed');
loggers.controller.error({ error: err }, 'Controller error occurred');
loggers.processor.debug({ inputPath }, 'Processing file');
```

## Available Loggers

| Logger               | Purpose                  | Usage                                     |
| -------------------- | ------------------------ | ----------------------------------------- |
| `loggers.app`        | Application-level events | Server startup, shutdown, configuration   |
| `loggers.controller` | HTTP controllers         | Request handling, validation, responses   |
| `loggers.service`    | Business logic services  | Media processing, file operations         |
| `loggers.processor`  | Media processors         | FFmpeg operations, image/video processing |
| `loggers.asset`      | Asset management         | Sticker/font operations                   |
| `loggers.validation` | Input validation         | Schema validation, data parsing           |
| `loggers.request`    | HTTP middleware          | Request/response logging                  |
| `loggers.error`      | Error handling           | Global error handling, exceptions         |

## Log Levels

| Level   | When to Use                      | Example                                    |
| ------- | -------------------------------- | ------------------------------------------ |
| `error` | Failures, exceptions             | Database connection failed, FFmpeg error   |
| `warn`  | Issues that don't stop execution | Missing optional files, fallback used      |
| `info`  | Important events                 | Processing started, API calls, completions |
| `debug` | Development information          | Variable values, intermediate steps        |
| `trace` | Very verbose debugging           | Function entry/exit, detailed flow         |

## Basic Logging Examples

### Simple Messages

```typescript
import { loggers } from '../utils/logger';

// Information
loggers.service.info('Media processing started');

// Warnings
loggers.controller.warn('Request missing optional parameter');

// Errors
loggers.processor.error('FFmpeg command failed');

// Debug information
loggers.service.debug('Generated output filename');
```

### Structured Logging

```typescript
// Include context with your logs
loggers.controller.info(
  {
    userId: req.user?.id,
    fileSize: req.file.size,
    processing: {
      type: 'image',
      filters: ['blur', 'sharpen'],
    },
  },
  'Processing user upload'
);

// Error with context
loggers.service.error(
  {
    error: err,
    inputPath: '/tmp/input.jpg',
    operation: 'image_resize',
    duration: Date.now() - startTime,
  },
  'Image processing failed'
);
```

## Logging Utilities

The `logUtils` object provides helper functions for common logging patterns:

### Processing Operations

```typescript
import { loggers, logUtils } from '../utils/logger';

const startTime = Date.now();

// Log start of operation
logUtils.logProcessingStart(loggers.processor, 'video transcoding', {
  inputFormat: 'mp4',
  outputFormat: 'webm',
  dimensions: { width: 1920, height: 1080 },
});

try {
  // ... processing logic ...

  // Log successful completion
  logUtils.logProcessingComplete(
    loggers.processor,
    'video transcoding',
    {
      outputPath: '/outputs/result.webm',
      fileSize: 15728640,
    },
    Date.now() - startTime
  );
} catch (error) {
  // Log processing error
  logUtils.logProcessingError(loggers.processor, 'video transcoding', error, {
    inputPath: '/tmp/input.mp4',
    partialOutput: true,
  });
}
```

### File Operations

```typescript
// Log file operations
logUtils.logFileOperation(
  loggers.service,
  'delete',
  '/tmp/upload_123.jpg',
  true, // success
  { cleanup: 'temporary_files' }
);
```

### HTTP Requests

```typescript
// Log HTTP operations (typically used in middleware)
logUtils.logRequest(
  loggers.request,
  'POST',
  '/api/process',
  200,
  1543, // duration in ms
  {
    fileType: 'image/jpeg',
    processingTime: 1200,
  }
);
```

## Component-Specific Examples

### Controllers

```typescript
import { loggers } from '../utils/logger';

export class MediaController {
  processMedia = asyncHandler(async (req: ProcessRequest, res: Response) => {
    // Log incoming request
    loggers.controller.info(
      {
        endpoint: 'processMedia',
        file: {
          name: req.file?.originalname,
          size: req.file?.size,
          type: req.file?.mimetype,
        },
        user: req.user?.id,
      },
      'Media processing request received'
    );

    try {
      const result = await this.mediaService.processMedia(
        req.file.path,
        request
      );

      // Log successful response
      loggers.controller.info(
        {
          outputUrl: result.outputUrl,
          processingTime: result.duration,
          success: true,
        },
        'Media processing completed successfully'
      );

      res.json(result);
    } catch (error) {
      // Error logging is handled by error middleware
      throw error;
    }
  });
}
```

### Services

```typescript
import { loggers, logUtils } from '../utils/logger';

export class MediaService {
  async processVideo(
    inputPath: string,
    options: VideoOptions
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    logUtils.logProcessingStart(loggers.service, 'video processing', {
      inputPath,
      options: {
        codec: options.codec,
        resolution: options.resolution,
        bitrate: options.bitrate,
      },
    });

    try {
      // Processing logic here...
      const result = await this.videoProcessor.process(inputPath, options);

      logUtils.logProcessingComplete(
        loggers.service,
        'video processing',
        {
          outputPath: result.outputPath,
          inputSize: result.inputSize,
          outputSize: result.outputSize,
          compressionRatio: result.inputSize / result.outputSize,
        },
        Date.now() - startTime
      );

      return result;
    } catch (error) {
      logUtils.logProcessingError(loggers.service, 'video processing', error, {
        inputPath,
        duration: Date.now() - startTime,
        options,
      });
      throw error;
    }
  }
}
```

### Processors

```typescript
import { loggers } from '../utils/logger';

export class ImageProcessor {
  async applyFilters(
    imagePath: string,
    filters: FilterConfig[]
  ): Promise<string> {
    loggers.processor.debug(
      {
        imagePath,
        filterCount: filters.length,
        filterTypes: filters.map(f => f.type),
      },
      'Applying image filters'
    );

    for (const filter of filters) {
      loggers.processor.debug(
        {
          filterType: filter.type,
          params: filter.parameters,
        },
        `Applying ${filter.type} filter`
      );

      await this.applyFilter(imagePath, filter);
    }

    loggers.processor.info(
      {
        imagePath,
        appliedFilters: filters.length,
      },
      'All filters applied successfully'
    );
  }
}
```

## Development vs Production

### Development Mode

- Uses `pino-pretty` for colored, human-readable output
- Shows more detailed information
- Includes file paths and line numbers

### Production Mode

- Outputs JSON logs for log aggregation systems
- Optimized for performance
- Structured for parsing by log management tools

## Environment Variables

| Variable    | Description                 | Default       |
| ----------- | --------------------------- | ------------- |
| `LOG_LEVEL` | Minimum log level to output | `info`        |
| `NODE_ENV`  | Environment mode            | `development` |

### Example .env Configuration

```bash
# Development
LOG_LEVEL=debug
NODE_ENV=development

# Production
LOG_LEVEL=info
NODE_ENV=production
```

## Best Practices

### ✅ Do's

- Use structured logging with context objects
- Choose appropriate log levels
- Include relevant metadata (file paths, IDs, sizes)
- Use the correct logger for each component
- Log the start and completion of important operations
- Include error context when logging failures

### ❌ Don'ts

- Don't log sensitive data (passwords, tokens, personal info)
- Don't use console.log, console.error (use loggers instead)
- Don't log at trace/debug level in production
- Don't include huge objects in log messages
- Don't log inside tight loops (use sampling instead)

### Example: Good vs Bad Logging

#### ❌ Bad

```typescript
console.log('Processing file');
console.error('Error:', error);
loggers.service.info('File processed');
```

#### ✅ Good

```typescript
loggers.service.info(
  {
    operation: 'file_processing',
    inputPath: '/uploads/image.jpg',
    mediaType: 'image',
    stage: 'start',
  },
  'Starting file processing'
);

loggers.service.error(
  {
    operation: 'file_processing',
    error: {
      message: error.message,
      stack: error.stack,
    },
    inputPath: '/uploads/image.jpg',
    stage: 'failed',
  },
  'File processing failed'
);
```

## Integration with Monitoring

The structured JSON logs can be easily integrated with monitoring systems:

- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Grafana Loki**: For log aggregation and visualization
- **Datadog**: Application performance monitoring
- **New Relic**: Application observability

The consistent structure makes it easy to create dashboards and alerts based on log data.
