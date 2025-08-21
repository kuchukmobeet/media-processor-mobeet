import {MediaDownloadResult} from "../../types/mediaService.types";

export interface IMediaService {
    downloadMediaFromUrl(
        url: string,
        opts?: { authToken?: string },
    ): Promise<MediaDownloadResult>
}
