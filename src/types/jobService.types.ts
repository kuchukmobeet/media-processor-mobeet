export abstract class JobDataBase {
    payload: any;

    protected constructor(payload: any) {
        this.payload = payload;
    }
}

export class CompressMediaReqJobData extends JobDataBase {
    constructor(url: string) {
        super(url);
    }
}

export interface ImageCompressionOptions {
    quality: number;      // 1-100, higher = better quality
    maxWidth?: number;    // Optional max width
    maxHeight?: number;   // Optional max height
}

export class CompressImageReqJobData extends JobDataBase {
    public options: ImageCompressionOptions;
    
    constructor(url: string, options: ImageCompressionOptions) {
        super(url);
        this.options = options;
    }
}

export interface JobState {
    state: string;
    jobData: JobDataBase;
}