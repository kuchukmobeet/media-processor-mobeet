import {container} from 'tsyringe';
import {IMediaService} from '../services/mediaService/IMediaService';
import {MediaServiceImpl} from '../services/mediaService/impl/MediaServiceImpl';
import {IFFmpegService} from '../services/FFmpegService/IFFmpegService';
import {FFmpegServiceImpl} from '../services/FFmpegService/impl/FFmpegServiceImpl';
import MediaController from '../controllers/mediaController';
import {IJobService} from "../services/jobService/IJobService";
import InMemoryJobService from "../services/jobService/inMemory/InMemoryJobService";
import {FFMPEG_SERVICE, JOB_SERVICE, MEDIA_SERVICE} from "../consts/DependencyConstants";
import JobController from "../controllers/JobController";

// Register service implementations
container.registerSingleton<IMediaService>(MEDIA_SERVICE, MediaServiceImpl);
container.registerSingleton<IFFmpegService>(FFMPEG_SERVICE, FFmpegServiceImpl);
container.registerSingleton<IJobService>(JOB_SERVICE, InMemoryJobService);
// Register controllers
container.registerSingleton(MediaController);
container.registerSingleton(JobController);

export {container};
