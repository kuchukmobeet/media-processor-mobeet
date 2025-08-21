import {JobDataBase} from "../../types/jobService.types";

export interface IJobService {
    /**
     * add a job for processing
     */
    addJob(jobData: JobDataBase): string;
}