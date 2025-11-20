declare module 'image-size' {
  interface ImageDimensions {
    width?: number;
    height?: number;
    type?: string;
  }

  function imageSize(input: Buffer | ArrayBuffer | Uint8Array | string): ImageDimensions;

  export default imageSize;
}


