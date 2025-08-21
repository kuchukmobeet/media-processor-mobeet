export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface CropRegion {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface MediaContent {
  position: Position;
  size?: Size;
  rotation: number;
  crop?: CropRegion;
}

export interface MediaBackground {
  aspectRatio: '9:16' | '4:5';
  color: string;
}

export interface MediaFilters {
  ffmpeg?: string;
  order?: string[];
}

export interface Sticker {
  name: string;
  position: Position;
  size?: Size;
  scale: number;
  rotation: number;
  z: number;
  opacity: number;
}

export interface TextOverlay {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fontFamily: string;
  fontWeight?: string;
  color: string;
  backgroundColor?: string;
  z: number;
}

export interface OutputSettings {
  quality: number;
}

export interface MediaRequest {
  post: boolean;
  mediaType: 'image' | 'video';
  background: MediaBackground;
  content: MediaContent;
  filters: MediaFilters;
  stickers: Sticker[];
  textOverlays?: TextOverlay[];
  output: OutputSettings;
}

export interface ProcessingResult {
  outputPath: string;
  duration?: number;
  size?: number;
}

export interface Canvas {
  width: number;
  height: number;
}
