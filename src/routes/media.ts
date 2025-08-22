import { Router, Request, Response } from 'express';
import { container } from '../container';
import MediaController from '../controllers/mediaController';

const router = Router();

// Get controller instance from DI container
const mediaController = container.resolve(MediaController);

// Bind methods to preserve 'this' context
router.post("/compress-video", async (req: Request, res: Response) => {
    await mediaController.compressMedia(req, res);
});

router.post("/compress-image", async (req: Request, res: Response) => {
    await mediaController.compressImage(req, res);
});

export default router;
