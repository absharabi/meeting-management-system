from faster_whisper import WhisperModel
import sys
import os

if len(sys.argv) < 2:
    print("Usage: python transcribe.py <audio_path> [model]", file=sys.stderr)
    sys.exit(1)

audio_path = sys.argv[1]
model_name = sys.argv[2] if len(sys.argv) > 2 else "base"

print(f"Audio path: {audio_path}", file=sys.stderr)
print(f"Exists: {os.path.exists(audio_path)}", file=sys.stderr)
print(f"Size: {os.path.getsize(audio_path) if os.path.exists(audio_path) else 0} bytes", file=sys.stderr)
print(f"Loading Whisper model: {model_name}", file=sys.stderr)

model = WhisperModel(model_name, device="cpu", compute_type="int8")

segments, info = model.transcribe(
    audio_path,
    beam_size=5,
    language="en",
    vad_filter=False,
)

print(f"Detected language: {info.language}", file=sys.stderr)
print(f"Language probability: {info.language_probability}", file=sys.stderr)
print(f"Duration: {info.duration}", file=sys.stderr)

texts = []
for segment in segments:
    print(
        f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}",
        file=sys.stderr
    )
    texts.append(segment.text.strip())

transcript = " ".join(texts).strip()

if not transcript:
    print("NO_TRANSCRIPT_DETECTED", file=sys.stderr)

print(transcript)