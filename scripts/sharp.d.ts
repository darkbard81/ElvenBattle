declare module 'sharp' {
  interface SharpInstance {
    resize(width: number, height: number): SharpInstance;
    webp(options?: { quality?: number }): SharpInstance;
    toBuffer(): Promise<Buffer>;
  }

  export default function sharp(input: Buffer | string): SharpInstance;
}
