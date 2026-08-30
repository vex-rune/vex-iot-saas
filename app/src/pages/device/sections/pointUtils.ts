import type { AccessType, DataType, PointDefinition } from '@/types/api';

// ─── 常量 ──────────────────────────────────────────────────────────────
export const DATA_TYPES: DataType[] = ['BOOL', 'LONG', 'STRING', 'DOUBLE'];
export const ACCESS_TYPES: AccessType[] = ['RO', 'RW'];
export const ACCESS_LABELS: Record<AccessType, string> = { RO: '只读', RW: '读写' };

/** 默认字典：BOOL 的 0/1 键值对 */
export const DEFAULT_BOOL_MAPPINGS: Array<{ key: string; label: string }> = [
  { key: '0', label: '关' },
  { key: '1', label: '开' },
];

// ─── 类型 ──────────────────────────────────────────────────────────────

/** 行草稿，既用于新增空行也用于现存的本地覆盖 */
export interface PointRow {
  _key: string;
  pointName: string;
  pointCode: string;
  description: string;
  unit: string;
  dataType: DataType;
  access: AccessType;
  groupLabel: string;
  groupKey?: string;
  /** 值→展示文本字典（本地数组，落地时序列化为 JSON 字符串） */
  valueMappings: Array<{ key: string; label: string }>;
}

/** 预设：一组默认值，点击后追加成新行 */
export interface PointPreset {
  key: string;
  label: string;
  defaults: Omit<PointRow, '_key'>;
}
// ─── 预设字典（4 组：数字 / 过程 / 电气 / 机械） ─────────────────────

const BOOL_PRESETS: PointPreset[] = [
  { key: 'switch', label: '开关', defaults: {
    pointName: '开关', pointCode: 'switch', description: '', unit: '',
    dataType: 'BOOL', access: 'RO',
    groupLabel: '开关',
    valueMappings: [...DEFAULT_BOOL_MAPPINGS],
  }},
  { key: 'startstop', label: '启停', defaults: {
    pointName: '启停', pointCode: 'start_stop', description: '', unit: '',
    dataType: 'BOOL', access: 'RW',
    groupLabel: '控制',
    valueMappings: [...DEFAULT_BOOL_MAPPINGS],
  }},
  { key: 'alarmflag', label: '告警', defaults: {
    pointName: '告警', pointCode: 'alarm', description: '', unit: '',
    dataType: 'BOOL', access: 'RO',
    groupLabel: '告警',
    valueMappings: [...DEFAULT_BOOL_MAPPINGS],
  }},
  { key: 'fault', label: '故障', defaults: {
    pointName: '故障', pointCode: 'fault', description: '', unit: '',
    dataType: 'BOOL', access: 'RO',
    groupLabel: '故障',
    valueMappings: [...DEFAULT_BOOL_MAPPINGS],
  }},
];

const PROCESS_PRESETS: PointPreset[] = [
  { key: 'temperature', label: '温度', defaults: {
    pointName: '温度', pointCode: 'temperature', description: '', unit: '℃',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '温度', valueMappings: [],
  }},
  { key: 'pressure', label: '压力', defaults: {
    pointName: '压力', pointCode: 'pressure', description: '', unit: 'MPa',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '压力', valueMappings: [],
  }},
  { key: 'flow', label: '流量', defaults: {
    pointName: '流量', pointCode: 'flow', description: '', unit: 'm³/h',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '流量', valueMappings: [],
  }},
  { key: 'totalflow', label: '累计流量', defaults: {
    pointName: '累计流量', pointCode: 'total_flow', description: '', unit: 'm³',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '流量', valueMappings: [],
  }},
  { key: 'level', label: '液位', defaults: {
    pointName: '液位', pointCode: 'level', description: '', unit: 'm',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '液位', valueMappings: [],
  }},
  { key: 'ph', label: 'pH', defaults: {
    pointName: 'pH', pointCode: 'ph', description: '', unit: '',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '水质', valueMappings: [],
  }},
  { key: 'concentration', label: '浓度', defaults: {
    pointName: '浓度', pointCode: 'concentration', description: '', unit: 'ppm',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '水质', valueMappings: [],
  }},
  { key: 'humidity', label: '湿度', defaults: {
    pointName: '湿度', pointCode: 'humidity', description: '', unit: '%RH',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '环境', valueMappings: [],
  }},
];

const ELECTRIC_PRESETS: PointPreset[] = [
  { key: 'current', label: '电流', defaults: {
    pointName: '电流', pointCode: 'current', description: '', unit: 'A',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '电气', valueMappings: [],
  }},
  { key: 'voltage', label: '电压', defaults: {
    pointName: '电压', pointCode: 'voltage', description: '', unit: 'V',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '电气', valueMappings: [],
  }},
  { key: 'frequency', label: '频率', defaults: {
    pointName: '频率', pointCode: 'frequency', description: '', unit: 'Hz',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '电气', valueMappings: [],
  }},
  { key: 'power', label: '功率', defaults: {
    pointName: '功率', pointCode: 'power', description: '', unit: 'kW',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '电气', valueMappings: [],
  }},
];

const MECHANICAL_PRESETS: PointPreset[] = [
  { key: 'speed', label: '转速', defaults: {
    pointName: '转速', pointCode: 'speed', description: '', unit: 'rpm',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '机械', valueMappings: [],
  }},
  { key: 'opening', label: '开度', defaults: {
    pointName: '开度', pointCode: 'opening', description: '', unit: '%',
    dataType: 'DOUBLE', access: 'RW', groupLabel: '阀门', valueMappings: [],
  }},
  { key: 'vibration', label: '振动', defaults: {
    pointName: '振动', pointCode: 'vibration', description: '', unit: 'mm/s',
    dataType: 'DOUBLE', access: 'RO', groupLabel: '机械', valueMappings: [],
  }},
];

export const POINT_PRESET_GROUPS: Array<{ label: string; presets: PointPreset[] }> = [
  { label: '数字', presets: BOOL_PRESETS },
  { label: '过程', presets: PROCESS_PRESETS },
  { label: '电气', presets: ELECTRIC_PRESETS },
  { label: '机械', presets: MECHANICAL_PRESETS },
];

export const ALL_PRESETS: PointPreset[] = POINT_PRESET_GROUPS.flatMap((g) => g.presets);

// ─── 纯函数 ──────────────────────────────────────────────────────────

/** 把后端返回的 JSON 字符串解析为 [{key,label}];空或非法返回空数组 */
export function parseValueMappings(raw: string | null | undefined): Array<{ key: string; label: string }> {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([k, v]) => ({
      key: k,
      label: typeof v === 'string' ? v : String(v ?? ''),
    }));
  } catch {
    return [];
  }
}

/** 把 [{key,label}] 序列化为 JSON 字符串;空数组或全部空白视为未配置,输出 undefined */
export function serializeValueMappings(arr: Array<{ key: string; label: string }> | undefined): string | undefined {
  if (!arr) return undefined;
  const filtered = arr.filter((m) => m.key.trim() !== '' || m.label.trim() !== '');
  if (filtered.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const m of filtered) out[m.key] = m.label;
  return JSON.stringify(out);
}

/**
 * 序号化命名(支持复制场景):
 * 1. 把 rawCode 拆成 prefix 与序号 N(如 "switch_2" → prefix="switch", N=2)
 *    拆不开(无 _N)则 prefix=原值, N=0
 * 2. 起步 = N+1(如有 N)或 1
 * 3. 取起步 vs 已存在的同 prefix_N 最大值,较大者再 +1,确保不撞码
 * 4. 撞了就线性 +N 找空位
 * 5. rawCode 空时退化为 point
 */
export function generateUniquePointCode(
  rawCode: string,
  existingPoints: PointDefinition[],
  newRows: PointRow[],
): string {
  const trimmed = (rawCode || 'point').trim();
  const baseMatch = trimmed.match(/^(.+)_(\d+)$/);
  const prefix = baseMatch ? baseMatch[1] : trimmed;
  const startN = baseMatch ? Number(baseMatch[2]) + 1 : 1;

  const usedNums = new Set<number>();
  const usedCodes = new Set<string>();
  for (const p of existingPoints) {
    if (!p.pointCode) continue;
    usedCodes.add(p.pointCode.toLowerCase());
    const m = p.pointCode.match(/^(.+)_(\d+)$/);
    if (m && m[1].toLowerCase() === prefix.toLowerCase()) {
      usedNums.add(Number(m[2]));
    }
  }
  for (const r of newRows) {
    if (!r.pointCode) continue;
    usedCodes.add(r.pointCode.toLowerCase());
    const m = r.pointCode.match(/^(.+)_(\d+)$/);
    if (m && m[1].toLowerCase() === prefix.toLowerCase()) {
      usedNums.add(Number(m[2]));
    }
  }
  const base = (prefix || 'point').toLowerCase();
  if (usedNums.size === 0 && usedCodes.has(base)) usedNums.add(0);

  const maxN = usedNums.size === 0 ? 0 : Math.max(...usedNums);
  let n = Math.max(startN, maxN + 1);
  while (usedCodes.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/**
 * 序号化命名(支持复制场景):
 * 先看 baseName 自身是否带空格 + N:是则 N+1 起步,否则 1 起步;
 * 撞了就 +1 找空位;baseName 空时退化为"点位"。
 */
export function generateUniquePointName(
  baseName: string,
  existingPoints: PointDefinition[],
  newRows: PointRow[],
): string {
  const trimmed = (baseName || '点位').trim();
  const baseMatch = trimmed.match(/^(.*?)\s+(\d+)$/);
  const prefix = baseMatch ? baseMatch[1] : trimmed;
  const startN = baseMatch ? Number(baseMatch[2]) + 1 : 1;
  const base = (prefix || '点位').trim();

  const used = new Set<number>();
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\s+(\\d+)$`);
  for (const p of existingPoints) {
    const m = p.pointName?.match(re);
    if (m) used.add(Number(m[1]));
  }
  for (const r of newRows) {
    const m = r.pointName.match(re);
    if (m) used.add(Number(m[1]));
  }
  const maxN = used.size === 0 ? 0 : Math.max(...used);
  let n = Math.max(startN, maxN + 1);
  while (used.has(n)) n += 1;
  return `${base} ${n}`;
}

/**
 * 检查一行新增点位是否与已有/草稿编码冲突(同设备下 pointCode 唯一)
 * @param excludeId 现有点位里要排除的 id(编辑自己的行不算重复)
 */
export function isPointCodeConflict(
  row: PointRow,
  existingPoints: PointDefinition[],
  newRows: PointRow[],
  excludeId?: string,
): boolean {
  const code = row.pointCode.trim().toLowerCase();
  if (!code) return false;
  for (const p of existingPoints) {
    if (excludeId && p.id === excludeId) continue;
    if (p.pointCode && p.pointCode.toLowerCase() === code) return true;
  }
  for (const r of newRows) {
    if (r._key === row._key) continue;
    if (r.pointCode && r.pointCode.trim().toLowerCase() === code) return true;
  }
  return false;
}

/** 把后端 PointDefinition 字段按需投影成可覆盖的 Partial<PointRow>(只取可编辑字段) */
export function pickRowFields(src: Partial<PointDefinition>): Partial<PointRow> {
  const out: Record<string, unknown> = {};
  if (src.pointName !== undefined) out.pointName = src.pointName;
  if (src.pointCode !== undefined) out.pointCode = src.pointCode;
  if (src.description !== undefined) out.description = src.description;
  if (src.unit !== undefined) out.unit = src.unit;
  if (src.dataType !== undefined) out.dataType = src.dataType;
  if (src.access !== undefined) out.access = src.access;
  if (src.groupLabel !== undefined) out.groupLabel = src.groupLabel;
  if (src.valueMappings !== undefined) {
    if (typeof src.valueMappings === 'string') {
      out.valueMappings = parseValueMappings(src.valueMappings);
    } else {
      // 容错:意外透传对象时丢弃,避免渲染炸
      out.valueMappings = [];
    }
  }
  return out as Partial<PointRow>;
}
