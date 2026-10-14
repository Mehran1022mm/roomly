export const GRID_ASPECT_RATIO = 16 / 9
export const GRID_GAP = 10

export type GridLayout = {
  columns: number
  rows: number
  rowHeight: number
}

export type FittedBox = {
  width: number
  height: number
}

const EMPTY_LAYOUT: GridLayout = { columns: 1, rows: 0, rowHeight: 0 }
const EMPTY_BOX: FittedBox = { width: 0, height: 0 }

export function solveLayout(
  count: number,
  width: number,
  height: number,
  gap = GRID_GAP,
): GridLayout {
  if (count <= 0 || width <= 0 || height <= 0) return EMPTY_LAYOUT
  let best: GridLayout | null = null
  for (let rows = 1; rows <= count; rows += 1) {
    const columns = Math.ceil(count / rows)
    const tileWidth = (width - gap * (columns - 1)) / columns
    if (tileWidth <= 0) continue
    const rowHeight = tileWidth / GRID_ASPECT_RATIO
    if (rowHeight * rows + gap * (rows - 1) > height) continue
    if (!best || rowHeight > best.rowHeight) best = { columns, rows, rowHeight }
  }
  if (best) return best
  return { columns: 1, rows: count, rowHeight: Math.max((height - gap * (count - 1)) / count, 1) }
}

export function fitBox(width: number, height: number, aspect = GRID_ASPECT_RATIO): FittedBox {
  if (width <= 0 || height <= 0) return EMPTY_BOX
  const fitted = Math.min(width, height * aspect)
  return { width: fitted, height: fitted / aspect }
}
