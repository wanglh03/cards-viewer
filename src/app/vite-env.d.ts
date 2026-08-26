/// <reference types="vite/client" />

declare module "*.mdx" {
  import type { ComponentType } from "react";
  const content: ComponentType;
  export default content;
}

declare module "@mdx-js/rollup" {
  const plugin: (options?: Record<string, unknown>) => unknown;
  export default plugin;
}
