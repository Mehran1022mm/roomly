export default function RoomLoading() {
  return (
    <main
      role="status"
      aria-label="Loading"
      className="flex h-dvh flex-col items-center justify-center gap-3 bg-canvas"
    >
      <span aria-hidden="true" className="size-6 animate-spin rounded-full border-2 border-line border-t-accent" />
    </main>
  )
}
