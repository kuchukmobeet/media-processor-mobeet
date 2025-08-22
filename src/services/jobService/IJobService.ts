import {JobDataBase, JobState} from "../../types/jobService.types";
import {EventEmitter} from "node:events";

export interface IJobService {
    /**
     * add a job for processing
     */
    addJob(jobData: JobDataBase): string;

    getJobStatusByIds(ids: string[]): Map<string, string>;

    /**
     * Get the progress stream for a specific job
     */
    getJobProgressStream(jobId: string): EventEmitter | null;

    /**
     * Clean up job resources when client disconnects
     */
    cleanupJobStream(jobId: string): void;
}