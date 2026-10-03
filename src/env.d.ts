/// <reference types="vite/client" />

declare const __DATASET_META__: { companies: number; programs: number; platforms: number; compiledOn: string };

declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const url: string;
  export default url;
}
