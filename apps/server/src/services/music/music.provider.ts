/**
 * Music Provider Interface
 * 
 * Abstracts music generation capabilities.
 * Implementations should handle vendor-specific API calls, polling, and error handling.
 */
export interface MusicProvider {
  /**
   * Generate music from a text prompt.
   * 
   * @param input Music generation parameters
   * @returns Provider-specific job information and audio URL (if available)
   */
  generateMusic(input: {
    prompt: string;
    durationSeconds?: number;
  }): Promise<{
    provider: string;
    providerJobId?: string;
    audioUrl?: string;
    raw?: unknown;
  }>;
}
