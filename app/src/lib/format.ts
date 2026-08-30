import dayjs from 'dayjs';

const DEFAULT_TZ_OFFSET = '+08:00';

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : '-';
}

export function formatTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('HH:mm:ss') : '-';
}

export function toIso(value?: Date | string | number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = dayjs(value);
  return d.isValid() ? d.toISOString() : undefined;
}

export const TIMEZONE_OFFSET = DEFAULT_TZ_OFFSET;
