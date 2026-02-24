declare module "canvas" {
  export class Canvas {}

  const nodeCanvas: {
    Canvas: typeof Canvas;
  };

  export default nodeCanvas;
}

declare module "jsdom" {
  export interface DOMWindow extends Window {}

  export class JSDOM {
    constructor(html?: string, options?: Record<string, unknown>);
    window: DOMWindow;
  }
}
