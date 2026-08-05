import type { CSSProperties, ReactElement } from 'react'
import { ARK_MARK_DATA_URL } from './ark-mark-data'

export type ArkOfficeMarkProps = {
  readonly size?: number
  readonly className?: string
  readonly style?: CSSProperties
}

/**
 * ArkOffice brand mark for AI ribbon / panel chrome.
 * Raster (precomposited black badge + light shield) so every app shares one asset.
 */
export function ArkOfficeMark({
  size = 30,
  className,
  style,
}: ArkOfficeMarkProps): ReactElement {
  return (
    <img
      src={ARK_MARK_DATA_URL}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
    />
  )
}
