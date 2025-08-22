import {inject, injectable} from "tsyringe";
import {GetJobStatusRequest} from "../types/request.types";
import {getLogger} from "../logger";
import {IJobService} from "../services/jobService/IJobService";
import {JOB_SERVICE} from "../consts/DependencyConstants";
import {ApiResponse} from "../types/response.types";
import {Response} from "express";

@injectable()
export default class JobController {
    private readonly log = getLogger(JobController.name);

    constructor(@inject(JOB_SERVICE) private jobService: IJobService) {
    }

    /**
     * Get status of a jobs based on ids
     * @param req
     * @param res Map of id -> string status
     */
    getJobStatus(req: GetJobStatusRequest, res: Response): void {
        try {
            // Get IDs from query parameters
            // Support both single ID (?ids=abc) and comma-separated IDs (?ids=abc,def,ghi)
            const idsParam = req.query.ids as string;
            const ids: string[] = idsParam ? idsParam.split(',').map(id => id.trim()) : [];
            
            this.log.info(`Get job status for IDs: ${ids}`);

            if (ids.length === 0) {
                const errorResponse: ApiResponse<never> = {
                    success: false,
                    message: "No job IDs provided. Use ?ids=your-job-id or ?ids=id1,id2,id3",
                };
                res.status(400).json(errorResponse);
                return;
            }

            const jobStatuses = this.jobService.getJobStatusByIds(ids);

            // Convert Map to Object for proper JSON serialization
            const jobStatusesObj = Object.fromEntries(jobStatuses);

            // Create your ApiResponse structure
            const response: ApiResponse<Record<string, string>> = {
                success: true,
                message: "Fetched status for provided job ids",
                data: jobStatusesObj
            };

            // Send the response using Express
            res.status(200).json(response);

        } catch (error) {
            this.log.error(`Error fetching job status:`, error);

            const errorResponse: ApiResponse<never> = {
                success: false,
                message: "Failed to fetch job status",
                error: error instanceof Error ? error.message : "Unknown error"
            };

            res.status(500).json(errorResponse);
        }
    }
}