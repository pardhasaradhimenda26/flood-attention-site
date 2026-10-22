/**
 * The locator maps' view rings. The hero camera moves them every frame by
 * setting their transform, without a React render.
 */
export const viewMarkers = new Set<SVGGElement>()
