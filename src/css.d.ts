// Allow importing CSS files as text strings (esbuild's text loader).
declare module "*.css" {
  const css: string;
  export default css;
}
