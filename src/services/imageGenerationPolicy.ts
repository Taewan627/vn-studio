// Vite substitutes this public boolean only; no provider settings enter the client.
declare const __VN_AI_IMAGE_GENERATION_ENABLED__: boolean;

export const IMAGE_GENERATION_DISABLED = 'IMAGE_GENERATION_DISABLED';

/** SoftwareX defaults OFF. Client and server require separate explicit opt-in. */
export function isImageGenerationEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return typeof __VN_AI_IMAGE_GENERATION_ENABLED__ !== 'undefined' && __VN_AI_IMAGE_GENERATION_ENABLED__ === true;
  }
  return typeof process !== 'undefined' && process.env.AI_IMAGE_GENERATION_ENABLED === 'true';
}

export function requireImageGenerationEnabled(): void {
  if (!isImageGenerationEnabled()) {
    const error = new Error(IMAGE_GENERATION_DISABLED);
    error.name = 'ImageGenerationDisabledError';
    throw error;
  }
}
