declare module 'imagetracerjs' {
  type ImageData = {
    width: number;
    height: number;
    data: Uint8Array | Uint8ClampedArray;
  };
  type Options = {
    numberofcolors?: number;
    colorquantcycles?: number;
    colorsampling?: number;
    pathomit?: number;
    ltres?: number;
    qtres?: number;
    roundcoords?: number;
    viewbox?: boolean;
    scale?: number;
    desc?: boolean;
    strokewidth?: number;
  };
  const tracer: { imagedataToSVG(data: ImageData, options?: Options): string };
  export default tracer;
}
