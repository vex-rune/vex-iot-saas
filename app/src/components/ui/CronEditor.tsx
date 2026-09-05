import { useState, useEffect, useMemo } from 'react';
import { Select, SelectItem, Input, Chip } from '@heroui/react';

export interface CronEditorProps { value: string; onChange: (cron: string) => void; isDisabled?: boolean }

type Freq = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
const FREQS: [Freq, string][] = [['minutely', '每分钟'], ['hourly', '每小时'], ['daily', '每天'], ['weekly', '每周'], ['monthly', '每月'], ['custom', '自定义']];

const range = (n: number, pad = 2) => Array.from({ length: n }, (_, i) => ({ key: String(i), label: String(i).padStart(pad, '0') }));
const MIN = range(60), HR = range(24), DAY = range(31, 1).map(o => ({ key: o.key, label: String(Number(o.label)) }));
const WK = [{ key: '2', label: '周一' }, { key: '3', label: '周二' }, { key: '4', label: '周三' }, { key: '5', label: '周四' }, { key: '6', label: '周五' }, { key: '7', label: '周六' }, { key: '1', label: '周日' }];
const MO = range(12, 1).map(o => ({ key: o.key, label: `${Number(o.label)}月` }));

function detect(c: string) {
  const d: Record<string, string> = { minute: '0', hour: '8', day: '1', week: '2', month: '1', raw: '' };
  if (!c) return { f: 'daily' as Freq, p: d };
  const s = c.split(' ');
  if (s.length !== 6) return { f: 'custom' as Freq, p: { ...d, raw: c } };
  const [_, mn, hr, dy, mo, wk] = s;
  if (mn === '*' && hr === '*' && dy === '*' && mo === '*' && wk === '?') return { f: 'minutely' as Freq, p: d };
  if (hr === '*' && dy === '*' && mo === '*' && wk === '?') return { f: 'hourly' as Freq, p: { ...d, minute: mn } };
  if (dy === '*' && mo === '*' && wk === '?') return { f: 'daily' as Freq, p: { ...d, minute: mn, hour: hr } };
  if (dy === '?' && mo === '*') return { f: 'weekly' as Freq, p: { ...d, minute: mn, hour: hr, week: wk } };
  if (mo === '*' && wk === '?') return { f: 'monthly' as Freq, p: { ...d, minute: mn, hour: hr, day: dy } };
  return { f: 'custom' as Freq, p: { ...d, raw: c } };
}

function build(f: Freq, p: Record<string, string>): string {
  const { minute = '0', hour = '8', day = '1', week = '2', raw = '' } = p;
  return f === 'minutely' ? '0 * * * * ?' : f === 'hourly' ? `0 ${minute} * * * ?` : f === 'daily' ? `0 ${minute} ${hour} * * ?` : f === 'weekly' ? `0 ${minute} ${hour} ? * ${week}` : f === 'monthly' ? `0 ${minute} ${hour} ${day} * ?` : raw;
}

const Sel = ({ label, items, val, disabled, onChange, w = 'w-20' }: { label?: string; items: { key: string; label: string }[]; val: string; disabled?: boolean; onChange: (v: string) => void; w?: string }) => (
  <Select size="sm" label={label} selectedKeys={[val]} isDisabled={disabled} className={w} onSelectionChange={(k) => onChange(Array.from(k)[0] as string)}>
    {items.map((o) => <SelectItem key={o.key}>{o.label}</SelectItem>)}
  </Select>
);

export default function CronEditor({ value, onChange, isDisabled }: CronEditorProps) {
  const init = useMemo(() => detect(value), [value]);
  const [freq, setFreq] = useState<Freq>(init.f);
  const [parts, setParts] = useState(init.p);
  useEffect(() => { const d = detect(value); setFreq(d.f); setParts(d.p); }, [value]);
  const update = (f: Freq, p: Record<string, string>) => { setFreq(f); setParts(p); onChange(build(f, p)); };
  const sp = (k: string, v: string) => update(freq, { ...parts, [k]: v });

  return (
    <div className="flex flex-col gap-3">
      <Select size="sm" label="执行频率" selectedKeys={[freq]} isDisabled={isDisabled} onSelectionChange={(k) => update(Array.from(k)[0] as Freq, parts)}>
        {FREQS.map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)}
      </Select>
      {freq === 'hourly' &&
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-500">每小时第</span>
          <Sel items={MIN} val={parts.minute} disabled={isDisabled} onChange={(v) => sp('minute', v)} />
          <span className="text-sm text-foreground-500">分钟</span></div>}
      {freq === 'daily' &&
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-500">每天</span>
          <Sel items={HR} val={parts.hour} disabled={isDisabled} onChange={(v) => sp('hour', v)} />
          <span className="text-sm text-foreground-500">:</span>
          <Sel items={MIN} val={parts.minute} disabled={isDisabled} onChange={(v) => sp('minute', v)} />
        </div>}
      {freq === 'weekly' &&
        <div className="flex flex-col gap-2">
          <Sel label="星期" items={WK} val={parts.week} disabled={isDisabled} onChange={(v) => sp('week', v)} w="w-24" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground-500">时间</span>
            <Sel items={HR} val={parts.hour} disabled={isDisabled} onChange={(v) => sp('hour', v)} />
            <span className="text-sm text-foreground-500">:</span>
            <Sel items={MIN} val={parts.minute} disabled={isDisabled} onChange={(v) => sp('minute', v)} />
          </div>
        </div>}
      {freq === 'monthly' &&
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><Sel label="月份" items={MO} val={parts.month} disabled={isDisabled} onChange={(v) => sp('month', v)} w="w-24" /><Sel label="日期" items={DAY} val={parts.day} disabled={isDisabled} onChange={(v) => sp('day', v)} w="w-24" /></div><div className="flex items-center gap-2"><span className="text-sm text-foreground-500">时间</span><Sel items={HR} val={parts.hour} disabled={isDisabled} onChange={(v) => sp('hour', v)} /><span className="text-sm text-foreground-500">:</span><Sel items={MIN} val={parts.minute} disabled={isDisabled} onChange={(v) => sp('minute', v)} /></div></div>}
      {freq === 'custom' &&
        <Input size="sm" label="Cron 表达式" value={parts.raw || value} isDisabled={isDisabled} onValueChange={(v) => sp('raw', v)} placeholder="秒 分 时 日 月 周" description="6位格式：秒 分 时 日 月 周" />}
      {freq !== 'custom' &&
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-400">表达式:</span><Chip size="sm" variant="flat" color="default">{value || '未设置'}</Chip></div>}
    </div>
  );
}
