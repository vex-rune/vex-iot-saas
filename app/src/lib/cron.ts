/**
 * 把 Cron 表达式翻译成白话文。
 *
 * 当前只覆盖项目里 CronEditor 支持的常见模式：
 * - 每分钟
 * - 每小时（第 N 分钟）
 * - 每天 HH:MM
 * - 每周X HH:MM
 * - 每月N日 HH:MM
 *
 * 其他自定义表达式会原样返回 cron 字符串。
 */

const WEEK_NAMES: Record<string, string> = {
  '1': '周日',
  '2': '周一',
  '3': '周二',
  '4': '周三',
  '5': '周四',
  '6': '周五',
  '7': '周六',
};

function pad2(v: string | number): string {
  return String(v).padStart(2, '0');
}

export function cronToPlain(cron?: string): string {
  if (!cron) return '未设置';

  const s = cron.trim().split(/\s+/);
  if (s.length !== 6) return cron;

  const [/* sec */, min, hour, day, month, week] = s;

  // 每分钟：0 * * * * ?
  if (min === '*' && hour === '*' && day === '*' && month === '*' && (week === '?' || week === '*')) {
    return '每分钟执行一次';
  }

  // 每小时第 N 分钟：0 {min} * * * ?
  if (hour === '*' && day === '*' && month === '*' && (week === '?' || week === '*')) {
    return `每小时第 ${pad2(min)} 分钟执行`;
  }

  // 每天 HH:MM：0 {min} {hour} * * ?
  if (day === '*' && month === '*' && (week === '?' || week === '*')) {
    return `每天 ${pad2(hour)}:${pad2(min)} 执行`;
  }

  // 每周X HH:MM：0 {min} {hour} ? * {week}
  if (day === '?' && month === '*') {
    const weekName = WEEK_NAMES[week] ?? `星期${week}`;
    return `每${weekName} ${pad2(hour)}:${pad2(min)} 执行`;
  }

  // 每月N日 HH:MM：0 {min} {hour} {day} * ?
  if (month === '*' && (week === '?' || week === '*')) {
    return `每月 ${Number(day)} 日 ${pad2(hour)}:${pad2(min)} 执行`;
  }

  return cron;
}
