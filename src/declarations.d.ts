declare const __PSYCONNECT_API_URL__: string | undefined;

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.svg" {
  const src: string;
  export default src;
}
