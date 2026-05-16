/**
 * Deepgram real-time speech recognition.
 *
 * Replaces the Chrome Web Speech API entirely.
 *
 * How it works:
 *   1. getUserMedia() → raw mic stream
 *   2. MediaRecorder chunks audio every 100ms → Deepgram WebSocket
 *   3. Deepgram returns interim (is_final=false) and final (is_final=true) transcripts
 *   4. onResult(transcript, isFinal) — same contract as before, so the karaoke
 *      engine above this layer is completely unchanged.
 *
 * Why Deepgram vs Chrome Web Speech API:
 *   - Discrete, non-cumulative transcripts — no diff hacks needed
 *   - Consistent behaviour — no random restarts or silent drops
 *   - Works in any browser (not Chrome-only)
 *   - nova-2 model handles Indian English accent well
 */

import { useRef, useCallback } from 'react';

const DG_URL    = 'wss://api.deepgram.com/v1/listen';
const DG_PARAMS = new URLSearchParams({
  model:           'nova-2',
  language:        'en-IN',   // Indian English
  interim_results: 'true',    // partial results as user speaks
  punctuate:       'false',   // no punctuation — cleaner for word matching
  smart_format:    'false',   // don't auto-format numbers (our engine handles that)
  endpointing:     '300',     // detect utterance end after 300ms silence
});

/** Pick the best audio format the browser supports */
function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

export default function useSpeechRecognition({ onResult, onStateChange }) {
  const wsRef            = useRef(null);
  const recorderRef      = useRef(null);
  const streamRef        = useRef(null);
  const activeRef        = useRef(false);
  const onResultRef      = useRef(onResult);
  const onStateChangeRef = useRef(onStateChange);

  // Always keep refs current — no stale closures
  onResultRef.current      = onResult;
  onStateChangeRef.current = onStateChange;

  const stop = useCallback(() => {
    activeRef.current = false;

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    onStateChangeRef.current?.('stopped');
  }, []);

  const start = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('[Deepgram] Missing NEXT_PUBLIC_DEEPGRAM_API_KEY');
      onStateChangeRef.current?.('unsupported');
      return;
    }

    activeRef.current = true;
    onStateChangeRef.current?.('connecting');

    try {
      // 1. Mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // 2. Deepgram WebSocket
      const ws = new WebSocket(`${DG_URL}?${DG_PARAMS}&token=${apiKey}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!activeRef.current) { ws.close(); return; }
        onStateChangeRef.current?.('listening');

        // 3. Stream mic audio in 100ms chunks
        const mimeType = getSupportedMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        recorder.start(100);
      };

      // 4. Receive transcripts — discrete results, no cumulative strings
      ws.onmessage = (event) => {
        if (!activeRef.current) return;
        try {
          const msg     = JSON.parse(event.data);
          const text    = msg?.channel?.alternatives?.[0]?.transcript?.trim().toLowerCase();
          const isFinal = msg?.is_final ?? false;
          if (text) onResultRef.current?.(text, isFinal);
        } catch (_) { /* ignore malformed messages */ }
      };

      ws.onerror = (e) => {
        console.error('[Deepgram] WebSocket error', e);
        onStateChangeRef.current?.('error');
      };

      ws.onclose = (e) => {
        if (!activeRef.current) return;
        // Unexpected close — reconnect
        console.warn('[Deepgram] Connection closed, reconnecting…', e.code);
        onStateChangeRef.current?.('restarting');
        setTimeout(() => { if (activeRef.current) start(); }, 500);
      };

    } catch (err) {
      console.error('[Deepgram] Failed to start:', err.message);
      onStateChangeRef.current?.('unsupported');
      activeRef.current = false;
    }
  }, [stop]);

  const isSupported = () =>
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  return { start, stop, isSupported };
}
