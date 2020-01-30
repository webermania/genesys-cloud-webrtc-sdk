declare module 'wildemitter' {
  export default class WildEmitter {
    constructor ();
    /* on */
    on<P1 = any> (event: string, callback: (arg1: P1) => void): void;
    on<P1 = any, P2 = any> (event: string, callback: (arg1: P1, arg2: P2) => void): void;
    on<P1 = any, P2 = any, P3 = any> (event: string, callback: (arg1: P1, arg2: P2, arg3: P3) => void): void;
    on<P1 = any> (event: string, groupName: string, callback: (arg1: P1) => void): void;
    on<P1 = any, P2 = any> (event: string, groupName: string, callback: (arg1: P1, arg2: P2) => void): void;
    on<P1 = any, P2 = any, P3 = any> (event: string, groupName: string, callback: (arg1: P1, arg2: P2, arg3: P3) => void): void;

    /* once */
    once<P1 = any> (event: string, callback: (arg1: P1) => void): void;
    once<P1 = any, P2 = any> (event: string, callback: (arg1: P1, arg2: P2) => void): void;
    once<P1 = any, P2 = any, P3 = any> (event: string, callback: (arg1: P1, arg2: P2, arg3: P3) => void): void;
    once<P1 = any> (event: string, groupName: string, callback: (arg1: P1) => void): void;
    once<P1 = any, P2 = any> (event: string, groupName: string, callback: (arg1: P1, arg2: P2) => void): void;
    once<P1 = any, P2 = any, P3 = any> (event: string, groupName: string, callback: (arg1: P1, arg2: P2, arg3: P3) => void): void;

    /* off */
    off (event: string): void;
    off<P1 = any> (event: string, callback: (arg1: P1) => void): void;
    off<P1 = any, P2 = any> (event: string, callback: (arg1: P1, arg2: P2) => void): void;
    off<P1 = any, P2 = any, P3 = any> (event: string, callback: (arg1: P1, arg2: P2, arg3: P3) => void): void;

    /* emit */
    emit (event: string, ...args: any[]): void;

    /* utils */
    releaseGroup (groupName?: string): void;
    getWildcardCallbacks (): (...args: any[]) => void;
  }
}

declare module 'purecloud-streaming-client' {
  export default class StreamingClient {
    constructor (options: any);
    connect (): Promise<any>;
    notifications: {
      subscribe (topic: string, handler: (data: any) => {}): Promise<void>
    };
    webrtcSessions: {
      refreshIceServers (): Promise<any>;
    };
  }
}

declare module 'webrtc-stats-gatherer' {
  export default class WebrtcStatsGatherer {
    constructor (pc: any, options: any);
    collectInitialConnectionStats: () => void;
    on: (key, fn) => void;
  }
}

declare module 'browserama' {
  const broswerama: {
    readonly isChrome: boolean;
    readonly isChromeOrChromium: boolean;
    readonly isChromium: boolean;
    readonly isFirefox: boolean;
    readonly isSafari: boolean;
    readonly isOpera: boolean;
    readonly isEdge: boolean;
    readonly isIE: boolean;
    readonly isBlink: boolean;
  };

  export default broswerama;
}