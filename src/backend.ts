import * as http2 from 'http2';
import {BackendConfig, Metrics} from './types'

export class Backend {
  private connections : number = 0;
  private health: boolean = true;
  private lastResponseTime : number = 0;
  private session: http2.ClientHttp2Session | null = null
}
