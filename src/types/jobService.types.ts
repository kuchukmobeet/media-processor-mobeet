export abstract class JobDataBase {
    payload: any;

    protected constructor(payload: any) {
        this.payload = payload;
    }
}

export class CompressMediaReqJobData extends JobDataBase {
    constructor(url: string) {
        super(url);
    }
}