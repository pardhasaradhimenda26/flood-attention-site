/** Channel width (m) to tube radius (world units). Shared by WebGL and SVG views. */
export function widthToRadius(widthM: number): number {
  return 0.045 + 0.0043 * widthM
}
