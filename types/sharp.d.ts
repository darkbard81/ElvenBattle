declare module 'sharp' {
  type SharpFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

  type SharpInput = string | Buffer;

  type SharpInstance = {
    resize: (
      width?: number,
      height?: number,
      options?: {
        fit?: SharpFit;
      },
    ) => SharpInstance;
    composite: (
      images: Array<{
        input: SharpInput;
        left?: number;
        top?: number;
      }>,
    ) => SharpInstance;
    png: () => SharpInstance;
    toFile: (fileOut: string) => Promise<unknown>;
  };

  type SharpFactory = (input?: SharpInput) => SharpInstance;

  const sharp: SharpFactory;

  export default sharp;
}
