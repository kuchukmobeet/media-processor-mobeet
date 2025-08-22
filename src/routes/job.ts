import {Request, Response, Router} from 'express';
import JobController from "../controllers/JobController";
import {container} from '../container';

const router = Router();

const jobController = container.resolve(JobController);
router.get("/status", async (req: Request, res: Response) => {
    jobController.getJobStatus(req, res);
});

export default router;