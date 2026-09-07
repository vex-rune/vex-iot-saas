import type {CSSProperties, ImgHTMLAttributes} from 'react';
import clsx from 'clsx';

export interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'> {
    /** 渲染尺寸, 同时控制宽高。默认 32。 */
  size?: number | string;
}

/**
 * Vex 云物联 品牌标识 — 使用 public/favicon.svg
 */
export function BrandLogo({
  size = 32,
  className,
  style,
  title = 'Vex 云物联',
  ...rest
}: BrandLogoProps) {
  const dim: CSSProperties =
    typeof size === 'number'
      ? { width: `${size}px`, height: `${size}px` }
      : { width: size, height: size };

  return (
      <img
          src="/favicon.svg"
          alt={title}
      style={{ ...dim, ...style }}
      className={clsx('inline-block shrink-0', className)}
      {...rest}
      />
  );
}

export default BrandLogo;
