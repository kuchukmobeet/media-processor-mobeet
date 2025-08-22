import {Request, Response, Router} from 'express';
import JobController from "../controllers/JobController";
import {container} from '../container';

const router = Router();

const jobController = container.resolve(JobController);

// Get job status via HTTP polling (existing endpoint)
router.get("/status", async (req: Request, res: Response) => {
    jobController.getJobStatus(req, res);
});

// SSE endpoint for real-time job progress
router.get("/events/:jobId", async (req: Request, res: Response) => {
    jobController.getJobProgressSSE(req, res);
});

export default router;