const createCanvasContextStub = (): CanvasRenderingContext2D =>
  ({
    arc: () => undefined,
    beginPath: () => undefined,
    clearRect: () => undefined,
    closePath: () => undefined,
    createRadialGradient: () => ({
      addColorStop: () => undefined,
    }),
    fill: () => undefined,
    fillRect: () => undefined,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    lineTo: () => undefined,
    moveTo: () => undefined,
    rect: () => undefined,
    stroke: () => undefined,
    quadraticCurveTo: () => undefined,
  }) as unknown as CanvasRenderingContext2D

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => createCanvasContextStub(),
})
