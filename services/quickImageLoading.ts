// Browser-side validation is required even for server-normalized images and
// restored projects. Retaining the Image keeps the decoded resource available.
export const QUICK_IMAGE_DECODE_TIMEOUT_MS = 15_000;
export const QUICK_IMAGE_JOB_TIMEOUT_MS = 90_000;

export function withQuickImageTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Image preparation timed out')), timeoutMs);
    operation.then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}

export function decodeQuickImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error('Missing image')); return; }
    const image = new Image();
    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      image.onload = image.onerror = null;
      if (ok && image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image);
      else reject(new Error('Image could not be loaded and decoded'));
    };
    const timer = window.setTimeout(() => finish(false), QUICK_IMAGE_DECODE_TIMEOUT_MS);
    image.decoding = 'async';
    image.onerror = () => finish(false);
    image.onload = () => {
      // onload verifies the download; decode verifies the actual render resource.
      void image.decode().then(() => finish(true), () => finish(false));
    };
    image.src = url;
  });
}
