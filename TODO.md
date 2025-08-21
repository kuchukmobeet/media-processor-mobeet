# Independent Services (Standalone & Isolated)

- File Service :- File I/O, directory operations, cleanup, unique naming
- Asset Service :- Resolve sticker/font paths, list assets, validation
- Download Service :- Remote media download, timeout handling, cleanup
- FFmpeg Service :- Command execution, argument building, error handling
- Validation Service :- Schema validation, dependency checks, sanitization
- Transform Service :- Image/video transformations (crop, scale, rotate, filters)
- Overlay Service :- Sticker placement, text rendering, layer composition
- Compression Service :- Quality settings, format conversion, size optimization
- Introduce Abstract queue which can be replaced easily in future

# Orchestrators (Business Logic Workflows)

- Media Processing Orchestrator :- Upload → Transform → Overlay → Output
- Media Compression Orchestrator :- Download → Compress → Cleanup
- Asset Management Orchestrator :- Asset discovery, validation, serving

# Why This is Better:

- Each service has ONE clear job
- Services don't know about each other (true isolation)
- Orchestrators handle the "how things work together"
- Easy to test individual pieces
- Easy to swap implementations
- Clear data flow: Controller → Orchestrator → Services
- No inheritance complexity, just composition
