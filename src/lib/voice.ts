/**
 * Voice input for the assistant — two transcription engines with automatic
 * fallback so the mic keeps working even when the browser's cloud speech
 * service is unreachable:
 *
 * 1. Web Speech API (webkitSpeechRecognition) — cloud transcription via the
 *    browser (Chrome/Edge/Safari). Best quality, but requires the browser's
 *    speech service to be reachable.
 * 2. On-device Whisper (@xenova/transformers) — lazy-loaded, runs the
 *    whisper-tiny.en model fully in the browser. Used when the speech
 *    service is unreachable (network / service-not-allowed) or unsupported.
 */

/** Minimal typing for the browser Web Speech API (not in TS's DOM lib). */
export interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: { transcript: string };
    };
  };
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/** Resolve the browser's speech recognizer constructor, or null if unsupported. */
export function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return typeof ctor === "function"
    ? (ctor as unknown as new () => SpeechRecognitionLike)
    : null;
}

export type VoiceStatus =
  | { kind: "idle" }
  | { kind: "preflight" }
  | { kind: "downloading" }
  | { kind: "listening"; engine: "cloud" | "device" }
  | { kind: "transcribing" }
  | { kind: "error" };

export const VOICE_STATUS_HINT: Record<VoiceStatus["kind"], string> = {
  idle: "Try “add Two Sum” or “what's due?”",
  preflight: "Checking microphone…",
  downloading: "Downloading speech model…",
  listening: "Listening… speak now",
  transcribing: "Transcribing…",
  error: "Try “add Two Sum” or “what's due?”",
};

/** Whisper model used for on-device transcription (lazy-loaded). */
const DEVICE_MODEL = "Xenova/whisper-tiny.en";

let asrPromise: Promise<unknown> | null = null;

/**
 * Lazily load transformers.js and the Whisper pipeline (cached).
 * Uses @xenova/transformers v2 with its prebuilt browser bundle (stable
 * onnxruntime-web, classic int8 decoder) — the v4 engine's dev-build
 * runtime fails to load whisper's merged decoder graphs, and bundling
 * the package's source entry breaks under Turbopack.
 */
async function getAsr(): Promise<
  (audio: Float32Array) => Promise<{ text: string }>
> {
  if (!asrPromise) {
    asrPromise = import("@xenova/transformers/dist/transformers.js").then(
      async ({ pipeline }) => {
        const p = await pipeline("automatic-speech-recognition", DEVICE_MODEL);
        return p as unknown as (audio: Float32Array) => Promise<{ text: string }>;
      },
    );
  }
  return asrPromise as Promise<(audio: Float32Array) => Promise<{ text: string }>>;
}

/** Request mic permission up front so failures are explicit and early. */
export async function ensureMicPermission(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "Voice input needs a secure (HTTPS) connection with microphone access — this browser blocks it.";
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return null;
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "No microphone detected — plug one in and try again.";
    }
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Microphone access was blocked — allow it in your browser (address-bar icon) to use voice commands.";
    }
    if (name === "NotReadableError") {
      return "The microphone is in use by another app — close it and try again.";
    }
    return `Couldn't reach the microphone (${name || "unknown error"}).`;
  }
}

const SILENCE_MS = 2500; // stop recording after this much quiet
const MAX_RECORD_MS = 12_000; // hard cap so the mic never hangs

/**
 * Clean a raw transcript before it's sent as a command: strip the model's
 * non-speech tags ("[MUSIC PLAYING]", "(bell dings)", "[BLANK_AUDIO]") and
 * any punctuation-only remainder. Returns "" when no meaningful speech
 * remains — music or noise must never be fired as a command.
 */
export function cleanTranscript(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Downsample a Float32Array to 16 kHz mono (what Whisper expects). */
function to16kMono(buffer: Float32Array, fromRate: number): Float32Array {
  if (fromRate === 16000) return buffer;
  const ratio = fromRate / 16000;
  const out = new Float32Array(Math.floor(buffer.length / ratio));
  for (let i = 0; i < out.length; i++) {
    out[i] = buffer[Math.floor(i * ratio)];
  }
  return out;
}

export interface OfflineSessionHandlers {
  onStatus: (s: VoiceStatus) => void;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}

/**
 * Create an on-device (Whisper) listening session. `start()` runs the full
 * flow; the returned `stop()` stops recording and transcribes what was
 * heard; `cancel()` discards the recording entirely.
 */
export function createOfflineSession(handlers: OfflineSessionHandlers): {
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
  isRecording: () => boolean;
} {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let raf = 0;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let done = false;
  let cancelled = false;

  const cleanup = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    recorder = null;
    cancelAnimationFrame(raf);
    if (silenceTimer) clearTimeout(silenceTimer);
    if (watchdog) clearTimeout(watchdog);
    silenceTimer = null;
    watchdog = null;
  };

  const finish = (chunks: Blob[]) => {
    if (done) return;
    done = true;
    cleanup();
    handlers.onStatus({ kind: "transcribing" });
    (async () => {
      try {
        const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
        const ctx = new AudioContext();
        const audioBuf = await ctx.decodeAudioData(await blob.arrayBuffer());
        const mono = to16kMono(audioBuf.getChannelData(0), audioBuf.sampleRate);
        await ctx.close();
        const transcribe = await getAsr();
        const { text } = await transcribe(mono);
        const cleaned = cleanTranscript(text);
        if (cleaned) {
          handlers.onTranscript(cleaned);
        } else {
          handlers.onError(
            "I heard sound but no speech — if music or noise was playing, pause it and say a command like “add Two Sum”.",
          );
        }
      } catch {
        handlers.onError("Speech recognition failed — check the console and try again.");
      }
    })();
  };

  return {
    isRecording: () => !!(recorder && recorder.state !== "inactive"),
    start: async () => {
      handlers.onStatus({ kind: "downloading" });
      try {
        await getAsr();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        handlers.onStatus({ kind: "listening", engine: "device" });

        const mime = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "";
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => finish(chunks);

        // Silence detection via the analyser node.
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const levels = new Uint8Array(analyser.frequencyBinCount);
        const sample = () => {
          analyser.getByteTimeDomainData(levels);
          let sum = 0;
          for (let i = 0; i < levels.length; i++) {
            const v = (levels[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / levels.length);
          if (rms < 0.015) {
            silenceTimer ??= setTimeout(() => {
              if (recorder && recorder.state !== "inactive") recorder.stop();
            }, SILENCE_MS);
          } else {
            if (silenceTimer) clearTimeout(silenceTimer);
            silenceTimer = null;
          }
          raf = requestAnimationFrame(sample);
        };
        sample();
        watchdog = setTimeout(() => {
          if (recorder && recorder.state !== "inactive") recorder.stop();
        }, MAX_RECORD_MS);

        recorder.start(250);
      } catch (err) {
        cleanup();
        console.error("voice: offline session failed", err);
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          handlers.onError("No microphone detected — plug one in and try again.");
        } else if (name === "NotAllowedError") {
          handlers.onError("Microphone access was blocked — allow it in your browser to use voice commands.");
        } else if (name === "NotSupportedError") {
          handlers.onError("This browser can't record audio from your microphone — try Chrome or Edge, or type your command instead.");
        } else {
          handlers.onError("Couldn't start the microphone — try again.");
        }
      }
    },
    stop: () => {
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else {
        done = true;
        cleanup();
      }
    },
    cancel: () => {
      cancelled = true;
      done = true;
      cleanup();
    },
  };
}

/** Human-readable reason for a Web Speech API error code, or null to stay quiet. */
export function cloudSpeechErrorMessage(code: string): string | null {
  switch (code) {
    case "network":
      return null; // handled by the caller (switches to offline mode)
    case "service-not-allowed":
      return null; // handled by the caller (switches to offline mode)
    case "audio-capture":
      return null; // handled by the caller (switches to offline mode)
    case "not-allowed":
      return "Microphone access was blocked — allow it in your browser (address-bar icon) to use voice commands.";
    case "no-speech":
      return "I didn't hear anything — click the mic and try again, e.g. \"add Two Sum easy\".";
    case "language-not-supported":
      return "The speech service doesn't support this language — try English, or check your browser settings.";
    case "aborted":
      return null;
    default:
      return `Speech recognition hit an error (“${code}”) — try again.`;
  }
}
