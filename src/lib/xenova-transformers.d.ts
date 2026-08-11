/**
 * Minimal typings for the prebuilt browser bundle of @xenova/transformers
 * (the package's own types only cover the source entry, not the dist subpath).
 */
declare module "@xenova/transformers/dist/transformers.js" {
  export interface AutomaticSpeechRecognitionPipeline {
    (audio: Float32Array): Promise<{ text: string }>;
  }

  export function pipeline(
    task: "automatic-speech-recognition",
    model: string,
  ): Promise<AutomaticSpeechRecognitionPipeline>;
}
