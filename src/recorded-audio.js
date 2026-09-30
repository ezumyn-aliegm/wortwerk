let current = null;

export function stopRecording(audio) {
  if (!audio) return;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  if (current === audio) current = null;
}

export function playRecording(source, onError, AudioClass = globalThis.Audio) {
  stopRecording(current);
  const audio = new AudioClass(source);
  current = audio;
  audio.onended = () => { if (current === audio) current = null; };
  audio.onerror = () => { if (current === audio) { current = null; onError(); } };
  audio.play().catch(() => { if (current === audio) { current = null; onError(); } });
  return audio;
}
