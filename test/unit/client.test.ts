import WildEmitter from 'wildemitter';
import PureCloudWebrtcSdk from '../../src/client';
import { SdkConstructOptions } from '../../src/types/interfaces';

declare var global: {
  window: any,
  document: any
} & NodeJS.Global;

let { wss, ws, mockApis, random, PARTICIPANT_ID, closeWebSocketServer } = require('../test-utils');

describe('Client', () => {

  // check to make sure the server isn't running
  beforeAll(async () => {
    await closeWebSocketServer();
  });

  afterAll(async () => {
    await closeWebSocketServer();
  });

  afterEach(async () => {
    if (ws) {
      await Promise.resolve(ws.close());
      ws = null;
    }
    if (wss) {
      wss.removeAllListeners();
    }
    jest.resetAllMocks();
  });

  test('constructor | throws if options are not provided', () => {
    expect(() => {
      const sdk = new PureCloudWebrtcSdk(null); // eslint-disable-line
    }).toThrow();
  });

  test('constructor | throws if accessToken is not provided', () => {
    expect(() => {
      const sdk = new PureCloudWebrtcSdk({ environment: 'mypurecloud.com' } as SdkConstructOptions); // eslint-disable-line
    }).toThrow();
  });

  test('constructor | warns if environment is not valid', () => {
    const sdk1 = new PureCloudWebrtcSdk({ accessToken: '1234', environment: 'mypurecloud.con' } as SdkConstructOptions); // eslint-disable-line
    const sdk2 = new PureCloudWebrtcSdk({  // eslint-disable-line
      accessToken: '1234',
      environment: 'mypurecloud.con',
      logger: { warn: jest.fn() } as any
    } as SdkConstructOptions);

    expect(sdk2.logger.warn).toHaveBeenCalled();
  });

  test('constructor | warns if the logLevel is not valid', () => {
    const sdk = new PureCloudWebrtcSdk({
      accessToken: '1234',
      environment: 'mypurecloud.com',
      logLevel: 'ERROR',
      logger: { warn: jest.fn() } as any
    } as SdkConstructOptions);
    expect(sdk.logger.warn).toHaveBeenCalled();
  });

  test('constructor | does not warn if things are fine', () => {
    const sdk = new PureCloudWebrtcSdk({
      accessToken: '1234',
      environment: 'mypurecloud.com',
      logLevel: 'error',
      logger: { warn: jest.fn() } as any
    } as SdkConstructOptions);
    expect(sdk.logger.warn).not.toHaveBeenCalled();
  });

  test('constructor | sets up options with defaults', () => {
    const sdk = new PureCloudWebrtcSdk({ accessToken: '1234' } as SdkConstructOptions);
    expect(sdk.logger).toBe(console);
    expect(sdk._accessToken).toBe('1234');
    expect(sdk._environment).toBe('mypurecloud.com');
    expect(sdk._autoConnectSessions).toBe(true);
    expect(typeof sdk._customIceServersConfig).toBe('undefined');
    expect(sdk._iceTransportPolicy).toBe('all');
  });

  test('constructor | sets up options when provided', () => {
    const logger = {};
    const iceServers = [];
    const sdk = new PureCloudWebrtcSdk({
      accessToken: '1234',
      environment: 'mypurecloud.ie',
      autoConnectSessions: false,
      iceServers: iceServers as any,
      iceTransportPolicy: 'relay',
      logger: logger as any
    } as SdkConstructOptions);

    expect(sdk.logger).toBe(logger);
    expect(sdk._accessToken).toBe('1234');
    expect(sdk._environment).toBe('mypurecloud.ie');
    expect(sdk._autoConnectSessions).toBe(false);
    expect(sdk._customIceServersConfig).toBe(iceServers);
    expect(sdk._iceTransportPolicy).toBe('relay');
  });

  test('initialize | fetches org and person details, sets up the streaming connection', async () => {
    const { getOrg, getUser, getChannel, sdk } = mockApis();
    await sdk.initialize();
    getOrg.done();
    getUser.done();
    getChannel.done();
    expect(sdk._streamingConnection).toBeTruthy();
    sdk.logBuffer = [];
    sdk._optOutOfTelemetry = true;
  });

  test('initialize | throws if getting the org fails', done => {
    const { sdk } = mockApis({ failOrg: true });

    return sdk.initialize()
      .then(() => done.fail())
      .catch(() => done());
  });

  test('initialize | throws if getting the user fails', done => {
    const { sdk } = mockApis({ failUser: true });

    return sdk.initialize()
      .then(t => done.fail())
      .catch(() => done());
  });

  test('initialize | throws if setting up streaming connection fails', async done => {
    const { sdk } = mockApis({ failStreaming: true });
    sdk.initialize()
      .then(() => fail())
      .catch(() => done());
  }, 15 * 1000);

  test('initialize sets up event proxies', async () => {
    const { sdk } = mockApis();
    await sdk.initialize();

    const eventsToVerify = [
      { name: 'error', trigger: 'error', args: [new Error('test'), {}] },
      { name: 'trace', trigger: 'traceRtcSession' },
      {
        name: 'handledPendingSession',
        trigger: 'handledIncomingRtcSession',
        args: [1],
        transformedArgs: [1]
      },
      {
        name: 'cancelPendingSession',
        trigger: 'cancelIncomingRtcSession',
        args: [1],
        transformedArgs: [1]
      },
      { name: 'error', trigger: 'rtcSessionError' },
      { name: 'disconnected', trigger: 'session:end', args: [], transformedArgs: ['Streaming API connection disconnected'] }
    ];

    async function awaitEvent (sdk, eventName, trigger, args = [], transformedArgs) {
      if (!transformedArgs) {
        transformedArgs = args;
      }
      const promise = new Promise(resolve => {
        const handler = (...eventArgs) => {
          expect(transformedArgs).toEqual(eventArgs);
          sdk.off(eventName, handler);
          resolve();
        };
        sdk.on(eventName, handler);
      });
      if (typeof trigger === 'string') {
        sdk._streamingConnection._webrtcSessions.emit(trigger, ...args);
        sdk._streamingConnection._stanzaio.emit(trigger, ...args);
      } else {
        trigger(args);
      }
      await promise;
    }

    await Promise.all(eventsToVerify.map(e => awaitEvent(sdk, e.name, e.trigger, e.args, e.transformedArgs)));
  });

  test('connected | returns the streaming client connection status', async () => {
    const { sdk } = mockApis();
    await sdk.initialize();

    sdk._streamingConnection.connected = true;
    expect(sdk.connected).toBe(true);
    sdk._streamingConnection.connected = false;
    expect(sdk.connected).toBe(false);
  });

  test('acceptPendingSession | proxies the call to the streaming connection', async () => {
    const { sdk } = mockApis();
    await sdk.initialize();

    const promise = new Promise(resolve => {
      sdk._streamingConnection.webrtcSessions.on('rtcSessionError', resolve);
    });
    sdk._streamingConnection._webrtcSessions.acceptRtcSession = jest.fn();
    sdk.acceptPendingSession('4321');
    await promise;
  }
  );

  test('endSession | requests the conversation then patches the participant to disconnected', async () => {
    const sessionId = random();
    const conversationId = random();
    const participantId = PARTICIPANT_ID;
    const { sdk, getConversation, patchConversation } = mockApis({ conversationId, participantId });
    await sdk.initialize();

    const mockSession = { id: sessionId, conversationId, end: jest.fn() };
    sdk._sessionManager.sessions = {};
    sdk._sessionManager.sessions[sessionId] = mockSession;

    await sdk.endSession({ id: sessionId });
    getConversation.done();
    patchConversation.done();
    expect(mockSession.end).not.toHaveBeenCalled();
  });

  // test.serial('endSession | requests the conversation then patches the participant to disconnected', async t => {
  //   const sessionId = random();
  //   const conversationId = random();
  //   const participantId = PARTICIPANT_ID;
  //   const { sdk, getConversation, patchConversation } = mockApis({ conversationId, participantId });
  //   await sdk.initialize();

  //   const mockSession = { id: sessionId, conversationId, end: sinon.stub() };
  //   sdk._sessionManager.sessions = {};
  //   sdk._sessionManager.sessions[sessionId] = mockSession;

  //   await sdk.endSession({ conversationId });
  //   getConversation.done();
  //   patchConversation.done();
  //   sinon.assert.notCalled(mockSession.end);
  // });

  test('endSession | rejects if not provided either an id or a conversationId', async done => {
    const { sdk } = mockApis();
    await sdk.initialize();
    await sdk.endSession({})
      .then(() => {
        done.fail();
      })
      .catch(err => {
        expect(err).toBeTruthy();
        done();
      });
  });

  test('endSession | rejects if not provided anything', async done => {
    const { sdk } = mockApis();
    await sdk.initialize();
    await sdk.endSession()
      .then(() => {
        done.fail();
      })
      .catch(err => {
        expect(err).toBeTruthy();
        done();
      });
  });

  test('endSession | rejects if the session is not found', async done => {
    const sessionId = random();
    const conversationId = random();
    const participantId = PARTICIPANT_ID;
    const { sdk } = mockApis({ conversationId, participantId });
    await sdk.initialize();

    const mockSession = { id: random(), conversationId, end: jest.fn() };
    sdk._sessionManager.sessions = {};
    sdk._sessionManager.sessions[mockSession.id] = mockSession;

    await sdk.endSession({ id: sessionId })
      .then(() => {
        done.fail();
      })
      .catch(err => {
        expect(err).toBeTruthy();
        done();
      });
  });

  test('endSession | ends the session and rejects if there is an error fetching the conversation', async done => {
    const sessionId = random();
    const conversationId = random();
    const participantId = random();
    const { sdk } = mockApis({ conversationId, participantId });
    await sdk.initialize();

    const mockSession = { id: sessionId, conversationId, end: jest.fn() };
    sdk._sessionManager.sessions = {};
    sdk._sessionManager.sessions[sessionId] = mockSession;

    await sdk.endSession({ id: sessionId })
      .then(() => {
        done.fail();
      })
      .catch(err => {
        expect(err).toBeTruthy();
        done();
      });
  });

  test('endSession | terminates the session of the existing session has no conversationId', async () => {
    const sessionId = random();
    const conversationId = random();
    const participantId = random();
    const { sdk, getConversation } = mockApis({ conversationId, participantId });
    await sdk.initialize();

    const mockSession = { id: sessionId, end: jest.fn() };
    sdk._sessionManager.sessions = {};
    sdk._sessionManager.sessions[sessionId] = mockSession;
    await sdk.endSession({ id: sessionId });
    expect(() => getConversation.done()).toThrow();
    expect(mockSession.end).toHaveBeenCalledTimes(1);
  });

  test('disconnect | proxies the call to the streaming connection', async () => {
    const { sdk } = mockApis();
    await sdk.initialize();

    sdk._streamingConnection.disconnect = jest.fn();

    sdk.disconnect();
    expect(sdk._streamingConnection.disconnect).toHaveBeenCalledTimes(1);
  });

  test('reconnect | proxies the call to the streaming connection', async () => {
    const { sdk } = mockApis();
    await sdk.initialize();

    sdk._streamingConnection.reconnect = jest.fn();

    sdk.reconnect();
    expect(sdk._streamingConnection.reconnect).toHaveBeenCalledTimes(1);
  });

  test('_customIceServersConfig | gets reset if the client refreshes ice servers', async () => {
    const { sdk } = mockApis();
    await sdk.initialize();
    sdk._customIceServersConfig = [{ something: 'junk' }];

    sdk._streamingConnection.sessionManager = {
      iceServers: [{ urls: ['turn:mypurecloud.com'] }]
    };

    await sdk._streamingConnection.webrtcSessions.refreshIceServers();
    const actual = sdk._sessionManager.iceServers;
    expect(actual).toEqual([
      {
        type: 'turn',
        urls: 'turn:turn.us-east-1.mypurecloud.com:3456',
        username: 'turnuser:12395',
        credential: 'akskdfjka='
      },
      {
        type: 'stun',
        urls: 'stun:turn.us-east-1.mypurecloud.com:3456'
      }
    ]);
  });

  test('onPendingSession | emits a pendingSession event and accepts the session', async () => {
    const { sdk } = mockApis();
    await sdk.initialize();

    jest.spyOn(sdk, 'acceptPendingSession');
    const pendingSession = new Promise(resolve => {
      sdk.on('pendingSession', resolve);
    });

    sdk._streamingConnection._webrtcSessions.emit('requestIncomingRtcSession', {
      sessionId: '1077',
      autoAnswer: true,
      conversationId: 'deadbeef-guid',
      fromJid: '+15558675309@gjoll.mypurecloud.com/instance-id'
    });

    const sessionInfo: any = await pendingSession;
    expect(sessionInfo.id).toBe('1077');
    expect(sessionInfo.conversationId).toBe('deadbeef-guid');
    expect(sessionInfo.address).toBe('+15558675309');
    expect(sessionInfo.autoAnswer).toBe(true);
    expect(sdk.acceptPendingSession).toHaveBeenCalledTimes(1);
    expect(sdk.acceptPendingSession).toHaveBeenCalledWith('1077');
  });

  test('onPendingSession | emits a pendingSession event but does not accept the session if autoAnswer is false', async () => {
    const { sdk } = mockApis();
    await sdk.initialize();

    jest.spyOn(sdk, 'acceptPendingSession');
    const pendingSession = new Promise(resolve => {
      sdk.on('pendingSession', resolve);
    });

    sdk._streamingConnection._webrtcSessions.emit('requestIncomingRtcSession', {
      sessionId: '1077',
      autoAnswer: false,
      conversationId: 'deadbeef-guid',
      fromJid: '+15558675309@gjoll.mypurecloud.com/instance-id'
    });

    const sessionInfo: any = await pendingSession;
    expect(sessionInfo.id).toBe('1077');
    expect(sessionInfo.conversationId).toBe('deadbeef-guid');
    expect(sessionInfo.address).toBe('+15558675309');
    expect(sessionInfo.autoAnswer).toBe(false);
    expect(sdk.acceptPendingSession).not.toHaveBeenCalled();
  });

  class MockSession extends WildEmitter {
    streams: any[];
    sid: any;
    pc: any;
    _statsGatherer: any;
    _outboundStream: any;
    constructor () {
      super();
      this.streams = [];
      this.sid = random();
      this.pc = new WildEmitter();
    }
    accept () { }
    addStream () { }
    end () { }
  }

  class MockTrack {
    stop () { }
  }

  class MockStream {
    _tracks: MockTrack[];
    constructor () {
      this._tracks = [new MockTrack()];
    }
    getTracks () {
      return this._tracks;
    }
  }

  test('onSession | starts media, attaches it to the session, attaches it to the dom, accepts the session, and emits a started event', async () => {
    const mockOutboundStream = new MockStream();
    const { sdk } = mockApis({ withMedia: mockOutboundStream });
    await sdk.initialize();

    const getUserMediaSpy = jest.spyOn(global.window.navigator.mediaDevices, 'getUserMedia');
    const bodyAppend = new Promise(resolve => {
      jest.spyOn(global.document.body, 'append').mockImplementation(resolve);
    });

    const sessionStarted = new Promise(resolve => sdk.on('sessionStarted', resolve));

    const mockSession = new MockSession();
    mockSession.sid = random();
    sdk._pendingSessions[mockSession.sid] = mockSession;
    mockSession.streams = [new MockStream()];
    jest.spyOn(mockSession, 'addStream');
    jest.spyOn(mockSession, 'accept');

    sdk._streamingConnection._webrtcSessions.emit('incomingRtcSession', mockSession);
    await sessionStarted;

    mockSession._statsGatherer.emit('traces', { some: 'traces' });
    mockSession._statsGatherer.emit('stats', { some: 'stats' });
    jest.spyOn(mockSession._statsGatherer, 'collectInitialConnectionStats');
    mockSession.emit('change:active', mockSession, true);

    expect(mockSession._statsGatherer.collectInitialConnectionStats).toHaveBeenCalledTimes(1);
    expect(mockSession.addStream).toHaveBeenCalledTimes(1);
    expect(mockSession.accept).toHaveBeenCalledTimes(1);
    expect(getUserMediaSpy).toHaveBeenCalledTimes(1);

    const attachedAudioElement: any = await bodyAppend;
    expect(attachedAudioElement.srcObject).toBe(mockSession.streams[0]);

    const sessionEnded = new Promise(resolve => sdk.on('sessionEnded', resolve));
    mockSession.emit('terminated', mockSession);
    mockSession.emit('change:active', mockSession, false);
    expect(mockSession._statsGatherer.collectInitialConnectionStats).toHaveBeenCalledTimes(1);
    await sessionEnded;
  });

  test('onSession | uses existing media, attaches it to the session, attaches it to the dom in existing element when ready, and emits a started event', async () => {
    const mockOutboundStream = new MockStream();
    const mockAudioElement: any = { classList: { add () { } } };
    const { sdk } = mockApis({ withMedia: {} });
    await sdk.initialize();
    sdk.pendingStream = mockOutboundStream;
    sdk._autoConnectSessions = false;

    const getUserMediaSpy = jest.spyOn(global.window.navigator.mediaDevices, 'getUserMedia');

    jest.spyOn(global.document, 'querySelector').mockReturnValue(mockAudioElement);
    jest.spyOn(global.document.body, 'append');

    const sessionStarted = new Promise(resolve => sdk.on('sessionStarted', resolve));

    const mockSession = new MockSession();
    jest.spyOn(mockSession, 'addStream');
    jest.spyOn(mockSession, 'accept');

    sdk._streamingConnection._webrtcSessions.emit('incomingRtcSession', mockSession);
    await sessionStarted;

    expect(mockSession.addStream).toHaveBeenCalledTimes(1);
    expect(mockSession.addStream).toHaveBeenCalledWith(mockOutboundStream);
    expect(mockSession.accept).not.toHaveBeenCalled();
    expect(getUserMediaSpy).not.toHaveBeenCalled();

    const mockInboundStream = {};
    mockSession.emit('peerStreamAdded', mockSession, mockInboundStream);
    expect(mockAudioElement.srcObject).toBe(mockInboundStream);
    expect(global.document.body.append).not.toHaveBeenCalled();

    const sessionEnded = new Promise(resolve => sdk.on('sessionEnded', resolve));
    mockSession._outboundStream = null;
    mockSession.emit('terminated', mockSession);
    await sessionEnded;
  });

  test('onSession | uses existing media, attaches it to the session, attaches it to the dom in _pendingAudioElement element when ready, and emits a started event', async () => {
    const mockOutboundStream = new MockStream();
    const mockAudioElement: any = { classList: { add () { } } };
    const { sdk } = mockApis({ withMedia: {} });
    await sdk.initialize();
    sdk.pendingStream = mockOutboundStream;
    sdk._autoConnectSessions = false;
    sdk._pendingAudioElement = mockAudioElement;

    const getUserMediaSpy = jest.spyOn(global.window.navigator.mediaDevices, 'getUserMedia');
    jest.spyOn(global.document.body, 'append');

    const sessionStarted = new Promise(resolve => sdk.on('sessionStarted', resolve));

    const mockSession = new MockSession();
    jest.spyOn(mockSession, 'addStream');
    jest.spyOn(mockSession, 'accept');

    sdk._streamingConnection._webrtcSessions.emit('incomingRtcSession', mockSession);
    await sessionStarted;

    expect(mockSession.addStream).toHaveBeenCalledTimes(1);
    expect(mockSession.addStream).toHaveBeenCalledWith(mockOutboundStream);
    expect(mockSession.accept).not.toHaveBeenCalled();
    expect(getUserMediaSpy).not.toHaveBeenCalled();

    const mockInboundStream = {};
    mockSession.emit('peerStreamAdded', mockSession, mockInboundStream);
    expect(mockAudioElement.srcObject).toBe(mockInboundStream);
    expect(global.document.body.append).not.toHaveBeenCalled();
  });

  test('_refreshTurnServers | refreshes the turn servers', async () => {
    const { sdk } = mockApis();
    await sdk.initialize();

    sdk._streamingConnection.connected = true;
    expect(sdk.connected).toBe(true);

    jest.spyOn(sdk._streamingConnection._webrtcSessions, 'refreshIceServers').mockReturnValue(Promise.resolve());
    await sdk._refreshTurnServers();
    expect(sdk._streamingConnection._webrtcSessions.refreshIceServers).toHaveBeenCalledTimes(1);
    expect(sdk._refreshTurnServersInterval).toBeTruthy();
  });

  test('_refreshTurnServers | emits an error if there is an error refreshing turn servers', async () => {
    const { sdk } = mockApis();
    await sdk.initialize();

    sdk._streamingConnection.connected = true;
    expect(sdk.connected).toBe(true);

    const promise = new Promise(resolve => sdk.on('error', resolve));
    jest.spyOn(sdk._streamingConnection._webrtcSessions, 'refreshIceServers').mockReturnValue(Promise.reject(new Error('fail')));
    await sdk._refreshTurnServers();
    expect(sdk._streamingConnection._webrtcSessions.refreshIceServers).toHaveBeenCalledTimes(1);
    await promise;
  });
});