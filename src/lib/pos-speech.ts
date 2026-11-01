"use client";

import type { AnnouncementKey } from "@/lib/pos-announcement-keys";

const AUDIO_BASE = "/api/pos/audio";

export type SpeechLang = "de" | "zh";

type QueueItem = { key: AnnouncementKey; text: string; lang: SpeechLang };
let queue: QueueItem[] = [];
let playing = false;
let currentAudio: HTMLAudioElement | null = null;
let enabled = true;

export function setSpeechEnabled(value: boolean) {
  enabled = value;
  if (!value) {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    queue = [];
    playing = false;
  }
}

function speak(text: string, lang: SpeechLang) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "zh" ? "zh-CN" : "de-DE";
  utterance.rate = lang === "zh" ? 0.95 : 1.05;
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function playAudioOrSpeech(
  key: AnnouncementKey,
  text: string,
  lang: SpeechLang,
  done: () => void,
) {
  if (typeof window === "undefined") return done();

  // Die vorproduzierten Ansagen gibt es nur auf Deutsch. Sie werden daher in
  // allen Sprachen abgespielt; die Browser-TTS dient nur noch als Fallback,
  // falls die MP3 nicht geladen werden kann.
  const audio = new Audio(`${AUDIO_BASE}/${key}`);

  let settled = false;
  const finish = (usedSpeech: boolean) => {
    if (settled) return;
    settled = true;
    if (usedSpeech) {
      const duration = Math.min(Math.max(text.length * 65, 1200), 6000);
      window.setTimeout(done, duration);
    } else {
      done();
    }
  };

  audio.addEventListener("loadeddata", () => {
    audio.play().catch(() => {
      speak(text, lang);
      finish(true);
    });
    currentAudio = audio;
    audio.onended = () => {
      currentAudio = null;
      finish(false);
    };
  }, { once: true });

  audio.addEventListener("error", () => {
    currentAudio = null;
    speak(text, lang);
    finish(true);
  }, { once: true });
}

async function processQueue() {
  if (!enabled || playing || queue.length === 0) return;
  playing = true;
  const item = queue.shift()!;

  playAudioOrSpeech(item.key, item.text, item.lang, () => {
    playing = false;
    void processQueue();
  });
}

function next() {
  playing = false;
  void processQueue();
}

export function announce(
  key: AnnouncementKey,
  text: string,
  lang: SpeechLang = "de",
) {
  if (typeof window === "undefined" || !enabled) return;
  queue.push({ key, text, lang });
  void processQueue();
}

export function clearAnnouncements() {
  queue = [];
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  playing = false;
}

export function formatSpokenEuro(cents: number, lang: SpeechLang = "de") {
  const euros = cents / 100;
  if (lang === "zh") {
    return `${euros.toFixed(2)} 欧元`;
  }
  return `${euros.toFixed(2).replace(".", ",")} Euro`;
}
