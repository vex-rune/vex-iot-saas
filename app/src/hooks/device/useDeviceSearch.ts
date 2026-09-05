/**
 * Dashboard 设备搜索 hook:
 * - 输入即时态(本地) + 提交态(触发后端查询)
 * - 关键词推 predicate 到后端(覆盖全量,不受 size 限制)
 */
import { useState } from 'react';
import type { Predicate } from '@/types/api';

export interface DeviceSearchValue {
  input: string;
  applied: string;
  setInput: (v: string) => void;
  setApplied: (v: string) => void;
  submit: () => void;
  reset: () => void;
}

export function useDeviceSearch(): DeviceSearchValue {
  const [input, setInput] = useState('');
  const [applied, setApplied] = useState('');
  return {
    input,
    setInput,
    applied,
    setApplied,
    submit: () => setApplied(input.trim()),
    reset: () => {
      setInput('');
      setApplied('');
    },
  };
}

/** 把 applied 关键词编译成 OR(name/l1Tag/l2Tag/l3Tag) predicate */
export function deviceSearchPredicate(applied: string): Predicate | undefined {
  const k = applied.trim();
  if (!k) return undefined;
  const like = `%${k}%`;
  return {
    or: [
      { condition: { field: 'deviceName', op: 'like', value: like } },
      { condition: { field: 'level1Tag', op: 'like', value: like } },
      { condition: { field: 'level2Tag', op: 'like', value: like } },
      { condition: { field: 'level3Tag', op: 'like', value: like } },
    ],
  };
}

