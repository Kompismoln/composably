declare module 'composably:content' {
  const content: (path: string) => Promise<import('./types.d.ts').PageContent>;
  export default content;
}

declare module 'composably:content/*' {
  const pageLoader: () => Promise<import('./types.d.ts').PageContent>;
  export default pageLoader;
}
