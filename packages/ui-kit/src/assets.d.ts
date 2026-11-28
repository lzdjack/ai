// Asset imports resolved by the app's bundler (Vite) to URLs.
declare module '*.svg' {
  const url: string;
  export default url;
}
declare module '*.png' {
  const url: string;
  export default url;
}
