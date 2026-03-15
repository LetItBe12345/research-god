export type CanvasHostHandler = {
  rootDir?: string;
  close: () => Promise<void>;
};

export type CanvasHostServer = {
  port?: number;
  close: () => Promise<void>;
};

export async function createCanvasHostHandler(_params: {
  runtime: unknown;
  rootDir?: string;
  basePath?: string;
  allowInTests?: boolean;
  liveReload?: boolean;
}): Promise<CanvasHostHandler> {
  return {
    rootDir: undefined,
    close: async () => {},
  };
}
