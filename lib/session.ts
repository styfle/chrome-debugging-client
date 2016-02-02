import {
  default as DefaultBrowserResolver,
  BrowserResolver,
  ResolveOptions
} from "./browser-resolver";
import {
  default as DefaultBrowserSpawner,
  BrowserSpawner,
  BrowserProcess
} from "./browser-spawner";
import {
  default as DefaultTmpDirCreator,
  TmpDirCreator
} from "./tmpdir-creator";
import {
  default as DefaultHTTPClientFactory,
  HTTPClientFactory,
  HTTPClient
} from "./http-client-factory";
import {
  default as DefaultAPIClientFactory,
  APIClientFactory,
  APIClient
} from "./api-client-factory";
import {
  default as DefaultWebSocketOpener,
  WebSocketOpener
} from "./web-socket-opener";
import {
  default as DefaultDebuggingProtocolFactory,
  DebuggingProtocolFactory,
  DebuggingProtocol
} from "./debugging-protocol-factory";
import { Disposable } from "./common";

export interface Session extends Disposable {
  spawn(browserType: string, options?: ResolveOptions): Promise<BrowserProcess>;
  createAPIClient(host, port): APIClient;
  openDebuggingProtocol(webSocketDebuggerUrl: string): Promise<DebuggingProtocol>;
}

export default async function createSession<T>(cb: (session: Session) => T | PromiseLike<T>): Promise<T> {
  let session = new SessionImpl(
    new DefaultBrowserResolver(),
    new DefaultTmpDirCreator(),
    new DefaultBrowserSpawner(),
    new DefaultHTTPClientFactory(),
    new DefaultAPIClientFactory(),
    new DefaultWebSocketOpener(),
    new DefaultDebuggingProtocolFactory()
  );
  try {
    return await cb(session);
  } finally {
    await session.dispose();
  }
}

class SessionImpl {
  disposables: Disposable[] = [];

  browserResolver: BrowserResolver;
  tmpDirCreator: TmpDirCreator;
  browserSpawner: BrowserSpawner;
  httpClientFactory: HTTPClientFactory;
  apiClientFactory: APIClientFactory;
  webSocketOpener: WebSocketOpener;
  debuggingProtocolFactory: DebuggingProtocolFactory;

  constructor(
    browserResolver: BrowserResolver,
    tmpDirCreator: TmpDirCreator,
    browserSpawner: BrowserSpawner,
    httpClientFactory: HTTPClientFactory,
    apiClientFactory: APIClientFactory,
    webSocketOpener: WebSocketOpener,
    debuggingProtocolFactory: DebuggingProtocolFactory
  ) {
    this.browserResolver = browserResolver;
    this.tmpDirCreator = tmpDirCreator;
    this.browserSpawner = browserSpawner;
    this.httpClientFactory = httpClientFactory;
    this.apiClientFactory = apiClientFactory;
    this.webSocketOpener = webSocketOpener;
    this.debuggingProtocolFactory = debuggingProtocolFactory;
  }

  async spawn(browserType: string, options?: ResolveOptions): Promise<BrowserProcess> {
    let browser = this.browserResolver.resolve(browserType, options);
    let tmpDir = await this.tmpDirCreator.create();
    this.disposables.push(tmpDir);
    let process = await this.browserSpawner.spawn(browser.executablePath, tmpDir.path, browser.isContentShell);
    this.disposables.push(process);
    return process;
  }

  createAPIClient(host: string, port: number): APIClient {
    return this.apiClientFactory.create(this.httpClientFactory.create(host, port));
  }

  async openDebuggingProtocol(webSocketDebuggerUrl: string): Promise<DebuggingProtocol> {
    let debuggingProtocol = this.debuggingProtocolFactory.create();
    let connection = await this.webSocketOpener.open(webSocketDebuggerUrl, debuggingProtocol);
    this.disposables.push(connection);
    return debuggingProtocol;
  }

  dispose() {
    return Promise.all(this.disposables.map(disposable => disposable.dispose()));
  }
}