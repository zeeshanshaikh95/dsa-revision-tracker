"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, Mic, MicOff, Send, X } from "lucide-react";
import type { Store } from "../hooks/useStore";
import { parseChat } from "../lib/assistant";
import { relativeDay, todayKey } from "../lib/spaced";
import {
  cleanTranscript,
  cloudSpeechErrorMessage,
  createOfflineSession,
  ensureMicPermission,
  getRecognitionCtor,
  type SpeechRecognitionLike,
  type VoiceStatus,
  VOICE_STATUS_HINT,
} from "../lib/voice";

interface Msg {
  id: number;
  role: "user" | "bot";
  text: string;
  chips?: string[];
}

const WELCOME: Msg = {
  id: 0,
  role: "bot",
  text:
    "Hey! I'm your DSA assistant 🤖 I can add, remove, search and update problems, tell you what's due, and summarize your progress. Try a command below, or type \"help\". Tap the mic 🎤 to speak commands.",
  chips: ["What's due today?", "Add \"Two Sum\" difficulty=easy", "Stats"],
};

export function ChatBot({ store }: { store: Store }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [pendingConfirm, setPendingConfirm] = useState<"clear" | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>({ kind: "idle" });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const offlineRef = useRef<ReturnType<typeof createOfflineSession> | null>(null);
  const switchingRef = useRef(false);
  const offlineWarnedRef = useRef(false);

  const voiceActive =
    voiceStatus.kind !== "idle" && voiceStatus.kind !== "error";

  // Abort any in-flight recognition session when the panel unmounts.
  useEffect(() => {
    return () => {
      recRef.current?.abort();
      offlineRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (open) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      inputRef.current?.focus();
    }
  }, [messages, open]);

  const respond = (text: string, chips?: string[]) => {
    setMessages((m) => [
      ...m,
      { id: idRef.current++, role: "bot", text, chips },
    ]);
  };

  /** Merge a recognized phrase with anything typed, then fire it. */
  const finishTranscript = (spoken: string) => {
    const clean = cleanTranscript(spoken);
    const typed = inputRef.current?.value.trim() ?? "";
    if (!clean) {
      if (typed) {
        setInput("");
        send(typed);
      } else {
        respond(
          "I heard sound but no speech — if music or noise was playing, pause it and say a command like “add Two Sum”.",
        );
      }
      setVoiceStatus({ kind: "idle" });
      return;
    }
    const merged = typed && clean ? `${typed} ${clean}` : typed || clean;
    setInput("");
    if (merged) send(merged);
    setVoiceStatus({ kind: "idle" });
  };

  /** On-device Whisper path — used when the cloud speech service is unreachable. */
  const beginOffline = () => {
    switchingRef.current = true;
    if (!offlineWarnedRef.current) {
      offlineWarnedRef.current = true;
      respond(
        "The browser's speech service isn't reachable from here, so I'm switching to on-device mode — the first run downloads a small speech model (~40MB), after that it's instant and fully offline.",
      );
    }
    const session = createOfflineSession({
      onStatus: setVoiceStatus,
      onTranscript: finishTranscript,
      onError: (msg) => {
        respond(msg);
        setVoiceStatus({ kind: "idle" });
      },
    });
    offlineRef.current = session;
    void session.start();
  };

  /** Cloud Web Speech path (Chrome/Edge/Safari's built-in recognizer). */
  const startCloud = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      beginOffline();
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i]?.[0]?.transcript ?? "";
      }
      const last = e.results[e.results.length - 1];
      const spoken = transcript.trim();
      if (last?.isFinal) {
        finishTranscript(spoken);
      } else if (!inputRef.current?.value) {
        // Live preview of the transcript while still speaking.
        setInput(spoken);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "audio-capture") {
        respond("No microphone detected — plug one in and try again.");
        setVoiceStatus({ kind: "idle" });
        return;
      }
      const msg = cloudSpeechErrorMessage(e.error);
      if (msg) {
        respond(msg);
        setVoiceStatus({ kind: "idle" });
        return;
      }
      // network / service-not-allowed → fall back to on-device transcription.
      setVoiceStatus({ kind: "idle" });
      beginOffline();
    };
    rec.onend = () => {
      if (!switchingRef.current) setVoiceStatus({ kind: "idle" });
    };
    recRef.current = rec;
    setVoiceStatus({ kind: "listening", engine: "cloud" });
    try {
      rec.start();
    } catch {
      setVoiceStatus({ kind: "idle" });
    }
  };

  const stopVoice = () => {
    if (recRef.current) {
      recRef.current.stop();
      setVoiceStatus({ kind: "idle" });
      return;
    }
    const off = offlineRef.current;
    if (off) {
      if (off.isRecording()) {
        off.stop(); // transcribe what was heard so far
      } else {
        off.cancel();
        setVoiceStatus({ kind: "idle" });
      }
    }
  };

  const startListening = async () => {
    if (voiceActive) {
      stopVoice();
      return;
    }
    switchingRef.current = false;
    setVoiceStatus({ kind: "preflight" });
    const micError = await ensureMicPermission();
    if (micError) {
      respond(micError);
      setVoiceStatus({ kind: "idle" });
      return;
    }
    if (getRecognitionCtor()) startCloud();
    else beginOffline();
  };

  const send = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text) return;
    setInput("");
    setMessages((m) => [
      ...m,
      { id: idRef.current++, role: "user", text },
    ]);

    // Clear-all confirmation gate.
    if (pendingConfirm === "clear") {
      setPendingConfirm(null);
      if (/^(yes|yep|confirm|do it|sure|go ahead|proceed)$/i.test(text)) {
        store.clearAllProblems();
        respond("Done — your problem bank is empty. Fresh start! 🌱", [
          "Add \"Two Sum\" difficulty=easy",
          "Stats",
        ]);
      } else {
        respond("Cancelled — nothing was cleared. What else can I do?", [
          "Help",
        ]);
      }
      return;
    }

    const action = parseChat(text, store.problems);
    switch (action.kind) {
      case "reply":
        respond(action.text, action.chips);
        break;
      case "add": {
        const p = store.addProblem(action.input);
        respond(
          `Added “${p.title}” (${p.module} · ${p.difficulty[0].toUpperCase()}${p.difficulty.slice(1)}) — first review ${relativeDay(p.nextReview, todayKey())}.`,
          ["What's due today?", "List all problems"],
        );
        break;
      }
      case "delete":
        store.deleteProblem(action.problem.id);
        respond(`Removed “${action.problem.title}”.`, [
          "List all problems",
          "What's due today?",
        ]);
        break;
      case "toggleStatus": {
        const wasCompleted = action.problem.status === "completed";
        store.toggleStatus(action.problem.id);
        respond(
          wasCompleted
            ? `Reopened “${action.problem.title}” — it's back in your active list.`
            : `“${action.problem.title}” marked complete 🎉`,
          ["What's due today?", "Stats"],
        );
        break;
      }
      case "resetReview": {
        const next = store.resetReview(action.problem.id);
        respond(
          `“${action.problem.title}” reset — next review ${relativeDay(next, todayKey())}.`,
          ["What's due today?", "List all problems"],
        );
        break;
      }
      case "update":
        store.updateProblem(action.problem.id, action.patch);
        respond(
          `Updated “${action.problem.title}”: ${action.changes.join(", ")}.`,
          ["List all problems", "Stats"],
        );
        break;
      case "clearAll":
        setPendingConfirm("clear");
        respond(
          `⚠️ This will permanently delete all ${store.problems.length} problems. Reply “confirm” to proceed, or anything else to cancel.`,
          ["Confirm", "Cancel"],
        );
        break;
    }
  };

  const placeholder =
    voiceStatus.kind === "listening"
      ? voiceStatus.engine === "device"
        ? "Listening (offline)…"
        : "Listening… speak now"
      : VOICE_STATUS_HINT[voiceStatus.kind];

  const bubble =
    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed";

  return (
    <div className="fixed bottom-4 right-4 z-[55] flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[540px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-zinc-800/70 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-zinc-100">DSA Assistant</p>
              <p className="text-[11px] text-zinc-500">
                Manages your problem bank
              </p>
            </div>
            <button
              onClick={() => {
                recRef.current?.abort();
                offlineRef.current?.cancel();
                setVoiceStatus({ kind: "idle" });
                setOpen(false);
              }}
              aria-label="Close assistant"
              className="ml-auto rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`${bubble} ${
                    m.role === "user"
                      ? "bg-emerald-500 text-zinc-950"
                      : "bg-zinc-800/80 text-zinc-200"
                  }`}
                >
                  {m.text}
                </div>
                {m.role === "bot" && m.chips && m.chips.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.chips.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => send(chip)}
                        className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-zinc-800/70 p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="button"
              onClick={startListening}
              aria-label={voiceActive ? "Stop voice input" : "Voice input"}
              title={
                voiceActive ? "Stop listening" : "Speak a command instead of typing"
              }
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                voiceActive
                  ? "border-rose-500/50 bg-rose-500/15 text-rose-400 animate-pulse"
                  : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-300"
              }`}
            >
              {voiceActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="submit"
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-zinc-950 transition-all hover:bg-emerald-400 active:scale-95"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating action button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        title="DSA Assistant"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 active:scale-95"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </button>
    </div>
  );
}
