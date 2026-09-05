import type { CSSProperties, SVGProps } from 'react';
import clsx from 'clsx';

export interface BrandLogoProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'xmlns'> {
  /** 渲染尺寸, 同时控制宽高。默认 32, 与浏览器 favicon 等比。 */
  size?: number | string;
  /** 是否显示深色模式变体 (深底容器)。默认 false 显示彩色品牌底。 */
  variant?: 'color' | 'mono-light' | 'mono-dark';
  /** 透传给 svg 根节点 */
  className?: string;
  style?: CSSProperties;
  /** 屏幕阅读器标签 */
  title?: string;
}

/**
 * Vex 云物联 品牌标识 (内联 SVG, 与 public/favicon.svg 同款设计)
 *
 * 使用场景:
 *  - 登录页 / 顶栏的品牌位 (variant="color")
 *  - 在浅色背景上的单色剪影 (variant="mono-light")
 *  - 在深色背景上的单色剪影 (variant="mono-dark")
 *
 * 设计语义:
 *  - 圆角方形 = 应用容器
 *  - 顶部节点 = 接入设备/传感器
 *  - 节点与 V 之间的连线 = 上行数据链路
 *  - V 形汇聚 = 数据汇入 Vex 平台, 同时是品牌首字母
 */
export function BrandLogo({
  size = 32,
  variant = 'color',
  className,
  style,
  title = 'Vex 云物联',
  ...rest
}: BrandLogoProps) {
  const dim: CSSProperties =
    typeof size === 'number'
      ? { width: `${size}px`, height: `${size}px` }
      : { width: size, height: size };

  // 内部所有坐标按 32×32 viewBox 设计; 通过外层宽高等比缩放
  // 颜色全部走 HeroUI CSS 变量,避免硬编码 hex
  const bgFill =
    variant === 'color'
      ? 'url(#vex-brand-bg)'
      : variant === 'mono-dark'
        ? 'var(--heroui-primary-700, currentColor)'
        : 'var(--heroui-background, currentColor)';
  const stroke =
    variant === 'mono-dark' || variant === 'color'
      ? 'var(--heroui-background, currentColor)'
      : 'var(--heroui-primary, currentColor)';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      style={{ ...dim, ...style }}
      className={clsx('inline-block shrink-0', className)}
      {...rest}
    >
      <defs>
        <linearGradient id="vex-brand-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--heroui-primary-500, currentColor)" />
          <stop offset="100%" stopColor="var(--heroui-primary-700, currentColor)" />
        </linearGradient>
      </defs>
      {/* 圆角方形品牌底 */}
      <rect width="32" height="32" rx="7" fill={bgFill} />
      {/* V 字主体 */}
      <path
        d="M7.5 10.5 L16 23 L24.5 10.5"
        stroke={stroke}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 顶端信号节点 */}
      <circle cx="16" cy="6.5" r="1.6" fill={stroke} />
      {/* 节点与 V 之间的连线, 表达上行链路 */}
      <path d="M16 8.4 L16 11.6" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

export default BrandLogo;
