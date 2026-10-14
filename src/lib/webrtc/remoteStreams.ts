const streams = new Map<string, MediaStream>()

export function setRemoteStream(peerId: string, stream: MediaStream): void {
  const previous = streams.get(peerId)
  if (previous && previous !== stream) stopStream(previous)
  streams.set(peerId, stream)
}

export function getRemoteStream(peerId: string): MediaStream | null {
  return streams.get(peerId) ?? null
}

export function deleteRemoteStream(peerId: string): void {
  const stream = streams.get(peerId)
  streams.delete(peerId)
  if (stream) stopStream(stream)
}

export function clearRemoteStreams(): void {
  for (const stream of streams.values()) stopStream(stream)
  streams.clear()
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      continue
    }
  }
}
