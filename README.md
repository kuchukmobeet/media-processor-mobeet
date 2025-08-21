# Media Processor

A high-performance Node.js media processing service that applies instagram story like filters, overlays stickers and text, and outputs optimized images or videos.  
Uses **FFmpeg** for media manipulation and **Redis** + **BullMQ** for job queuing.

---

## 🚀 Prerequisites

Make sure you have the following installed:

- **[Redis](https://redis.io/)** — for job queue processing.
- **[FFmpeg CLI](https://ffmpeg.org/)** — for image/video manipulation.
- **[Node.js](https://nodejs.org/)** (with [nvm](https://github.com/nvm-sh/nvm) recommended).

---

## 📦 Installation & Setup

```bash
# Step 1: Select the correct Node.js version
nvm use

# Step 2: Build the project
npm run build

# Step 3: Start the service
npm run start


## 1️⃣ Image Processing:
curl -v \
  --form "file=@/home/atanu/media-processor/uploads/atanu.png" \
  --form-string 'metadata={
    "post": false,
    "mediaType": "image",
    "background": {
      "aspectRatio": "9:16",
      "color": "#000000"
    },
    "content": {
      "position": { "x": 0, "y": 0 },
      "size": { "width": 1080, "height": 1920 },
      "rotation": 0
    },
    "filters": {
      "ffmpeg": "curves=all='\''0/0.05 0.3/0.25 0.7/0.8 1/1'\'',hue=s=0,eq=contrast=1.4:brightness=0.08"
    },
    "stickers": [
      { "name": "1971", "position": { "x": 100, "y": 400 }, "size": { "width": 200, "height": 200 }, "rotation": 0, "z": 10, "opacity": 1 },
      { "name": "1971", "position": { "x": 550, "y": 400 }, "size": { "width": 200, "height": 200 }, "rotation": 0, "z": 10, "opacity": 1 }
    ],
    "output": { "quality": 90 }
  }' \
  http://localhost:8000/process



## 2️⃣ Video Processing
curl -v \
  --form "file=@/home/atanu/media-processor/uploads/ufc.mp4" \
  --form-string 'metadata={
    "post": false,
    "mediaType": "video",
    "background": {
      "aspectRatio": "9:16",
      "color": "#000000"
    },
    "content": {
      "position": { "x": 0, "y": 0 },
      "size": { "width": 1080, "height": 1920 },
      "rotation": 0
    },
    "filters": {
      "ffmpeg": "colorbalance=rs=0.2:bs=-0.2,eq=saturation=1.1"
    },
    "stickers": [
      { "name": "1971", "position": { "x": 100, "y": 400 }, "size": { "width": 200, "height": 200 }, "rotation": 0, "z": 10, "opacity": 1 },
      { "name": "1971", "position": { "x": 550, "y": 400 }, "size": { "width": 200, "height": 200 }, "rotation": 0, "z": 10, "opacity": 1 }
    ],
    "output": { "quality": 90 }
  }' \
  http://localhost:8000/process
```
