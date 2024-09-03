import * as http2 from 'http2';
import {BackendConfig, Metrics} from './types'

export class Backend {
  private connections : number = 0;
  private health: boolean = true;
  private lastResponseTime : number = 0;
  private session: http2.ClientHttp2Session | null = null;
  private metrics : Metrics = { requestCount : 0, errorCount : 0, averageResponseTime : 0 };

  constructor(private config: BackendConfig){
    this.initSession();
  }

  private initSession() : void {
    this.session = http2.connect(this.config.url);
    this.session.on('error', (err) => {
      console.error(`Backend ${this.config,url} session error :`, err);
      this.health = false;
      this.session = null;
      setTimeout(() => this.initSession(), 5000);
    })
  }

  async handleReuest(headers : http2.IncomingHttpHeaders, payload: Buffer): Promise<{headers : http2.IncomingHttpHeaders, responseData : Buffer}> {
    if (!this.session){
      throw new Error('Backend session not available');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const stream = this.session!.request(headers);

      const reponseData : Buffer[] = [];
      const reponseHeaders : http2.IncomingHttpHeaders;

      stream.on('response',(headers) => {
        responseHeaders = headers;
      } )
    })
  }
}
