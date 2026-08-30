import { heroui } from '@heroui/react';

/**
 * 主题约定:
 * - 完全使用 HeroUI 插件内置的 light/dark 两套完整色板 (primary/success/warning/danger + content1~3 + background)
 * - 不自定义 primary hex, 不新增私有颜色变量
 * - 整站只消费语义化 token, 参考 https://canary.heroui.com/docs/customization/colors
 */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-18px)' },
        },
        floatSlow: {
          '0%,100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(12px) translateX(-8px)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        floatSlow: 'floatSlow 9s ease-in-out infinite',
        fadeInUp: 'fadeInUp 0.5s ease-out both',
      },
    },
  },
  darkMode: 'class',
  plugins: [
    heroui({
      defaultTheme: 'light',
      defaultExtendTheme: 'light',
      layout: {
        radius: {
          small: '8px',
          medium: '12px',
          large: '16px',
        },
        borderWidth: {
          small: '1px',
          medium: '1px',
          large: '2px',
        },
      },
      themes: {
        // 完整使用 HeroUI 自带的 light/dark 默认色板,不覆盖任何 primary/success hex
        light: {},
        dark: {},
      },
    }),
  ],
};
