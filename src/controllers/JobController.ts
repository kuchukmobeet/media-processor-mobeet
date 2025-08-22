import {inject, injectable} from "tsyringe";
import {GetJobStatusRequest} from "../types/request.types";
import {getLogger} from "../logger";
import {IJobService} from "../services/jobService/IJobService";
import {JOB_SERVICE} from "../consts/DependencyConstants";
import {ApiResponse} from "../types/response.types";
import {Request, Response} from "express";
import {JobProgressEvent} from "../types/jobService.types";

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

    /**
     * SSE endpoint for real-time job progress updates
     * @param req Express request with jobId parameter
     * @param res Express response for SSE
     */
    getJobProgressSSE(req: Request, res: Response): void {
        const jobId = req.params.jobId;

        if (!jobId) {
            res.status(400).json({
                success: false,
                message: "Job ID is required"
            });
            return;
        }

        this.log.info(`SSE connection requested for job: ${jobId}`);

        // Get the job's progress stream
        const progressStream = this.jobService.getJobProgressStream(jobId);

        if (!progressStream) {
            res.status(404).json({
                success: false,
                message: `Job with ID ${jobId} not found`
            });
            return;
        }

        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // Send initial connection confirmation
        res.write(`data: ${JSON.stringify({
            type: 'connected',
            jobId: jobId,
            timestamp: Date.now(),
            message: 'Connected to job progress stream'
        })}\n\n`);

        // Listen for progress events and forward them as SSE
        const progressListener = (event: JobProgressEvent) => {
            try {
                const sseData = {
                    type: 'progress',
                    jobId: jobId,
                    ...event
                };

                res.write(`data: ${JSON.stringify(sseData)}\n\n`);
                this.log.debug(`Sent SSE progress for job ${jobId}: ${event.phase} - ${event.message}`);
            } catch (error) {
                this.log.error(`Error sending SSE data for job ${jobId}:`, error);
            }
        };

        // Attach the listener to the progress stream
        progressStream.on('progress', progressListener);

        // Handle job completion/failure - send final event and close
        const completionStates = ['COMPLETED', 'FAILED'];
        const completionListener = (event: JobProgressEvent) => {
            if (completionStates.includes(event.phase)) {
                try {
                    const finalData = {
                        type: 'completion',
                        jobId: jobId,
                        ...event
                    };

                    res.write(`data: ${JSON.stringify(finalData)}\n\n`);
                    this.log.info(`Job ${jobId} completed, closing SSE connection`);

                    // Close the SSE connection
                    res.end();
                } catch (error) {
                    this.log.error(`Error sending completion SSE data for job ${jobId}:`, error);
                    res.end();
                }
            }
        };

        progressStream.on('progress', completionListener);

        // Handle client disconnect
        req.on('close', () => {
            this.log.info(`SSE client disconnected for job: ${jobId}`);

            // Remove listeners to prevent memory leaks
            progressStream.removeListener('progress', progressListener);
            progressStream.removeListener('progress', completionListener);

            // Clean up job stream if needed
            this.jobService.cleanupJobStream(jobId);
        });

        // Handle connection errors
        req.on('error', (error) => {
            this.log.error(`SSE connection error for job ${jobId}:`, error);

            // Remove listeners
            progressStream.removeListener('progress', progressListener);
            progressStream.removeListener('progress', completionListener);

            // Clean up
            this.jobService.cleanupJobStream(jobId);
        });

        // Keep connection alive with periodic heartbeat
        const heartbeatInterval = setInterval(() => {
            try {
                res.write(`data: ${JSON.stringify({
                    type: 'heartbeat',
                    jobId: jobId,
                    timestamp: Date.now()
                })}\n\n`);
            } catch (error) {
                this.log.error(`Heartbeat error for job ${jobId}:`, error);
                clearInterval(heartbeatInterval);
            }
        }, 30000); // Send heartbeat every 30 seconds

        // Clean up heartbeat on connection close
        req.on('close', () => {
            clearInterval(heartbeatInterval);
        });

        req.on('error', () => {
            clearInterval(heartbeatInterval);
        });
    }
}