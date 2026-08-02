"use client";

import type { AnnouncementKey } from "@/lib/pos-announcement-keys";

const AUDIO_BASE = "/api/pos/audio";

type QueueItem = { key: AnnouncementKey; text: string };
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

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  const german =
    voices.find((v) => v.lang.toLowerCase().startsWith("de")) ?? null;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  utterance.rate = 1.05;
  if (german) utterance.voice = german;
  window.speechSynthesis.speak(utterance);
}

function playAudioOrSpeech(key: AnnouncementKey, text: string, done: () => void) {
  if (typeof window === "undefined") return done();
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
      speak(text);
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
    speak(text);
    finish(true);
  }, { once: true });
}

async function processQueue() {
  if (!enabled || playing || queue.length === 0) return;
  playing = true;
  const item = queue.shift()!;

  playAudioOrSpeech(item.key, item.text, () => {
    playing = false;
    void processQueue();
  });
}

function next() {
  playing = false;
  void processQueue();
}

export function announce(key: AnnouncementKey, text: string) {
  if (typeof window === "undefined" || !enabled) return;
  queue.push({ key, text });
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

export function formatSpokenEuro(cents: number) {
  const euros = cents / 100;
  return `${euros.toFixed(2).replace(".", ",")} Euro`;
}
