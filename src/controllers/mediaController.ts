import {Response} from 'express';
import {getLogger} from '../logger';
import {inject, injectable} from "tsyringe";
import {CompressMediaRequest} from "../types/request.types";
import {ApiResponse} from "../types/response.types";
import {IJobService} from "../services/jobService/IJobService";
import {CompressMediaReqJobData} from "../types/jobService.types";
import {JOB_SERVICE} from "../consts/DependencyConstants";

@injectable()
export default class MediaController {
    private readonly logger = getLogger(MediaController.name);

    constructor(
        @inject(JOB_SERVICE) private jobService: IJobService
    ) {
    }

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
}
