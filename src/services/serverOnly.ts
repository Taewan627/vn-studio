// Vite-only replacement for the native image processor. Browser AI calls use the server proxy.
export default function serverOnly(): never {
  throw new Error('Image processing is only available on the server.');
}
