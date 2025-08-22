import {Response} from 'express';
import {getLogger} from '../logger';
import {inject, injectable} from "tsyringe";
import {CompressMediaRequest, CompressImageRequest} from "../types/request.types";
import {ApiResponse} from "../types/response.types";
import {IJobService} from "../services/jobService/IJobService";
import {CompressMediaReqJobData, CompressImageReqJobData} from "../types/jobService.types";
import {JOB_SERVICE} from "../consts/DependencyConstants";

@injectable()
export default class MediaController {
    private readonly logger = getLogger(MediaController.name);

    constructor(
        @inject(JOB_SERVICE) private jobService: IJobService
    ) {
    }
    //TODO detect type automatically in future
    //TODO get multiple job ids if job starts multiple sub jobs
    async compressMedia(req: CompressMediaRequest, res: Response): Promise<void> {
        this.logger.info('Compress media endpoint called');

        try {
            const id = this.jobService.addJob(new CompressMediaReqJobData(req.body.url));
            const responseBody: ApiResponse = {
                success: true,
                message: "Submitted task for compressing video. Use the id provided as data to track it using SSE",
                data: id
            };
            res.status(200).json(responseBody);
        } catch (error: any) {
            this.logger.error('Error in compressMedia:', error);
            const response: ApiResponse = {
                message: `Something went wrong when attempting to compress video ${req.body.url} : ${error.message}`,
                success: false,
            }
            res.status(500).json(response);
        }
    }

    async compressImage(req: CompressImageRequest, res: Response): Promise<void> {
        this.logger.info('Compress image endpoint called');

        try {
            // Validate quality parameter
            if (req.body.quality < 1 || req.body.quality > 100) {
                const response: ApiResponse = {
                    message: "Quality must be between 1 and 100",
                    success: false,
                };
                res.status(400).json(response);
                return;
            }

            const id = this.jobService.addJob(new CompressImageReqJobData(req.body.url, {
                quality: req.body.quality,
                maxWidth: req.body.maxWidth,
                maxHeight: req.body.maxHeight
            }));
            
            const responseBody: ApiResponse = {
                success: true,
                message: "Submitted task for compressing image. Use the id provided as data to track it using SSE",
                data: id
            };
            res.status(200).json(responseBody);
        } catch (error: any) {
            this.logger.error('Error in compressImage:', error);
            const response: ApiResponse = {
                message: `Something went wrong when attempting to compress image ${req.body.url} : ${error.message}`,
                success: false,
            }
            res.status(500).json(response);
        }
    }
}
