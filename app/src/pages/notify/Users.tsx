import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Input,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
  addToast,
} from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/useApiMutation';
import { useQueryList } from '@/hooks/common/useQueryList';
import { useIsMobile } from '@/hooks/common/useMediaQuery';
import { EntityCard, FieldRow } from '@/components/ui/EntityCard';
import SearchFilterBar from '@/components/ui/common/SearchFilterBar';
import type { FilterGroupSpec } from '@/components/ui/common/SearchFilterBar';
import { PencilIcon, PlusIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import {
  queryNotifyUsers,
  countNotifyUsers,
  saveNotifyUser,
  deleteNotifyUser,
  queryNotifyRecords,
  countNotifyRecords,
  queryNotifyTemplates,
  countNotifyTemplates,
  saveNotifyTemplate,
  deleteNotifyTemplate,
} from '@/services/notifyUsers';
import { formatDateTime } from '@/lib/format';
import type {
  NotifyUser,
  NotifyRecord,
  NotifyTemplate,
  NotifyTemplateType,
  NotifyTemplatePlatform,
  NotifyChannel,
  NotifyRecordStatus,
  Predicate,
  PredicateItem,
  QueryBody,
} from '@/types/api';

type RecordSortField = 'time' | 'status' | 'channel';

// ──────── 常量 ────────
const MAX_USERS = 6;
const MAX_TEMPLATES = 6;
// 手机号放宽:允许 + 国际区号、空格、短横线分隔,总长 7~20,至少 7 位数字
const PHONE_REGEX = /^\+?[\d\s-]{6,19}\d$/;
const PHONE_DIGIT_MIN = 7;
const PHONE_DIGIT_MAX = 15;
const MAX_NAME_LEN = 64;
const MAX_TPL_ID_LEN = 64;
const MAX_CONTENT_LEN = 500;
const TEMPLATE_ID_REGEX = /^[A-Za-z0-9_:-]+$/;
const RECORDS_PAGE_SIZE = 15;
const RECORD_SEARCH_DEBOUNCE_MS = 300;

const TYPE_OPTIONS: { key: NotifyTemplateType; label: string }[] = [
  { key: 'SMS', label: '短信' },
  { key: 'WECHAT', label: '微信' },
  { key: 'EMAIL', label: '邮件' },
];

const PLATFORM_OPTIONS: { key: NotifyTemplatePlatform; label: string }[] = [
  { key: 'ALIYUN', label: '阿里云' },
  { key: 'TENCENT', label: '腾讯云' },
  { key: 'HUAWEI', label: '华为云' },
  { key: 'OTHER', label: '其他' },
];

const CHANNEL_LABELS: Record<string, string> = {
  SMS: '短信', WECHAT: '微信', EMAIL: '邮件',
};

const RECORD_CHANNEL_OPTIONS: { key: 'ALL' | NotifyChannel; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'SMS', label: '短信' },
  { key: 'WECHAT', label: '微信' },
  { key: 'EMAIL', label: '邮件' },
];

const RECORD_STATUS_OPTIONS: { key: 'ALL' | NotifyRecordStatus; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'SUCCESS', label: '成功' },
  { key: 'FAILED', label: '失败' },
  { key: 'PENDING', label: '发送中' },
];

// ──────── 表单类型 ────────
type UserFormShape = { name: string; phone: string; smsEnabled: boolean; enabled: boolean };
type TplFormShape = {
  name: string;
  type: NotifyTemplateType;
  platform: NotifyTemplatePlatform;
  templateId: string;
  contentExample: string;
  enabled: boolean;
};
type UserFormErrors = Partial<Record<keyof UserFormShape, string>>;
type TplFormErrors = Partial<Record<keyof TplFormShape, string>>;

const userFormInitial: UserFormShape = { name: '', phone: '', smsEnabled: true, enabled: true };
const tplFormInitial: TplFormShape = {
  name: '', type: 'SMS', platform: 'ALIYUN',
  templateId: '', contentExample: '', enabled: true,
};

// ──────── 校验函数 ────────
function validateUserForm(form: UserFormShape): UserFormErrors {
  const errors: UserFormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = '请输入名称';
  else if (name.length > MAX_NAME_LEN) errors.name = `名称不能超过 ${MAX_NAME_LEN} 个字符`;
  const phone = form.phone.trim();
  if (!phone) errors.phone = '请输入手机号';
  else if (phone.length > 20) errors.phone = `手机号不能超过 20 个字符`;
  else if (!PHONE_REGEX.test(phone)) errors.phone = '手机号格式不正确';
  else {
    const digitCount = (phone.match(/\d/g) ?? []).length;
    if (digitCount < PHONE_DIGIT_MIN) errors.phone = `手机号至少需要 ${PHONE_DIGIT_MIN} 位数字`;
    else if (digitCount > PHONE_DIGIT_MAX) errors.phone = `手机号最多 ${PHONE_DIGIT_MAX} 位数字`;
  }
  return errors;
}

function validateTplForm(form: TplFormShape): TplFormErrors {
  const errors: TplFormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = '请输入模版名称';
  else if (name.length > MAX_NAME_LEN) errors.name = `名称不能超过 ${MAX_NAME_LEN} 个字符`;
  const templateId = form.templateId.trim();
  if (!templateId) errors.templateId = '请输入三方模版ID';
  else if (templateId.length > MAX_TPL_ID_LEN) errors.templateId = `三方模版ID不能超过 ${MAX_TPL_ID_LEN} 个字符`;
  else if (!TEMPLATE_ID_REGEX.test(templateId)) errors.templateId = '只允许字母、数字、下划线、冒号、横线';
  const content = form.contentExample;
  if (!content.trim()) errors.contentExample = '请输入内容示例';
  else if (content.length > MAX_CONTENT_LEN) errors.contentExample = `内容示例不能超过 ${MAX_CONTENT_LEN} 个字符`;
  return errors;
}

export default function NotifyUsers() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // 暂时不做权限过滤,所有登录用户都能编辑/删除
  // (后续可在此处接入 isAdmin(userRoles) 重新启用权限)

  // 用户/模版 区块折叠状态,默认折叠
  const [userExpanded, setUserExpanded] = useState(false);
  const [tplExpanded, setTplExpanded] = useState(false);

  // ═══════ 1. 通知用户(6 槽位卡片) ═══════
  const {
    data: users,
    isLoading: usersLoading,
  } = useQueryList<NotifyUser>({
    queryKey: 'notifyUsers',
    queryFn: queryNotifyUsers,
    countFn: countNotifyUsers,
    defaultSize: MAX_USERS,
  });

  const visibleUsers = users.slice(0, MAX_USERS);
  const isUserAtLimit = visibleUsers.length >= MAX_USERS;

  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<NotifyUser | null>(null);
  const [userForm, setUserForm] = useState<UserFormShape>(userFormInitial);
  const [userErrors, setUserErrors] = useState<UserFormErrors>({});

  const setUserField = <K extends keyof UserFormShape>(field: K, value: UserFormShape[K]) => {
    const next = { ...userForm, [field]: value };
    setUserForm(next);
    setUserErrors(validateUserForm(next));
  };

  const openCreateUser = () => {
    if (isUserAtLimit) {
      addToast({ title: `通知用户最多支持 ${MAX_USERS} 人`, color: 'warning' });
      return;
    }
    setEditingUser(null);
    setUserForm(userFormInitial);
    setUserErrors({});
    setUserDrawerOpen(true);
  };

  const openEditUser = (user: NotifyUser) => {
    setEditingUser(user);
    const form: UserFormShape = {
      name: user.name ?? '',
      phone: user.phone ?? '',
      smsEnabled: user.smsEnabled ?? true,
      enabled: user.enabled ?? true,
    };
    setUserForm(form);
    // 已落库的数据视为合法,只更新 form,不预先标红
    setUserErrors({});
    setUserDrawerOpen(true);
  };

  const closeUserDrawer = () => {
    setUserDrawerOpen(false);
    setUserErrors({});
  };

  // 新增/更新
  const saveUserUI = useApiMutation({
    mutationFn: (data: Partial<NotifyUser>) => saveNotifyUser(data),
  });

  // 删除
  const deleteUserUI = useApiMutation({
    mutationFn: (id: string) => deleteNotifyUser(id),
  });

  const handleSaveUser = () => {
    const errors = validateUserForm(userForm);
    if (Object.keys(errors).length > 0) {
      setUserErrors(errors);
      addToast({ title: '请检查表单填写', color: 'warning' });
      return;
    }
    saveUserUI.mutate(
      {
        ...(editingUser ? { id: editingUser.id } : {}),
        name: userForm.name.trim(),
        phone: userForm.phone.trim(),
        smsEnabled: userForm.smsEnabled,
        enabled: userForm.enabled,
      },
      {
        onSuccess: () => {
          addToast({ title: editingUser ? '更新成功' : '创建成功', color: 'success' });
          closeUserDrawer();
          queryClient.invalidateQueries({ queryKey: ['notifyUsers'] });
        },
        onError: (err: Error) =>
          addToast({ title: editingUser ? '更新失败' : '创建失败', description: err.message, color: 'danger' }),
      },
    );
  };

  const userHasErrors = useMemo(() => Object.keys(validateUserForm(userForm)).length > 0, [userForm]);

  // ═══════ 2. 通知记录(只读,标准表格 + 筛选) ═══════
  const [recordSearch, setRecordSearch] = useState('');
  const [recordChannel, setRecordChannel] = useState<'ALL' | NotifyChannel>('ALL');
  const [recordStatus, setRecordStatus] = useState<'ALL' | NotifyRecordStatus>('ALL');
  /** 排序:发送时间(默认)/发送状态/渠道 */
  const [recordSort, setRecordSort] = useState<RecordSortField>('time');
  const [recordDir, setRecordDir] = useState<'ASC' | 'DESC'>('DESC');
  const [debouncedRecordSearch, setDebouncedRecordSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedRecordSearch(recordSearch),
      RECORD_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [recordSearch]);

  const recordPredicate = useMemo<Predicate | undefined>(() => {
    const items: PredicateItem[] = [];
    const trimmed = debouncedRecordSearch.trim();
    if (trimmed) {
      items.push({ condition: { field: 'event', op: 'like' as const, value: `%${trimmed}%` } });
    }
    if (recordChannel !== 'ALL') {
      items.push({ condition: { field: 'channel', op: 'eq' as const, value: recordChannel } });
    }
    if (recordStatus !== 'ALL') {
      items.push({ condition: { field: 'status', op: 'eq' as const, value: recordStatus } });
    }
    return items.length > 0 ? { and: items } : undefined;
  }, [debouncedRecordSearch, recordChannel, recordStatus]);

  const recordOrder = useMemo<QueryBody['order']>(
    () => [{ field: recordSort, order: recordDir }],
    [recordSort, recordDir],
  );

  const {
    data: records,
    total: recordsTotal,
    page: recordsPage,
    size: recordsSize,
    setPage: setRecordsPage,
    setSize: setRecordsSize,
    isLoading: recordsLoading,
  } = useQueryList<NotifyRecord>({
    queryKey: 'notifyRecords',
    queryFn: queryNotifyRecords,
    countFn: countNotifyRecords,
    defaultSize: RECORDS_PAGE_SIZE,
    defaultPredicate: recordPredicate,
    defaultOrder: recordOrder,
  });

  const userNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.name ?? '');
    return m;
  }, [users]);

  // ═══════ 3. 通知模版(完整 CRUD) ═══════
  const {
    data: templates,
    isLoading: templatesLoading,
  } = useQueryList<NotifyTemplate>({
    queryKey: 'notifyTemplates',
    queryFn: queryNotifyTemplates,
    countFn: countNotifyTemplates,
    defaultSize: MAX_TEMPLATES,
  });

  const visibleTemplates = templates.slice(0, MAX_TEMPLATES);
  const isTplAtLimit = visibleTemplates.length >= MAX_TEMPLATES;

  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<NotifyTemplate | null>(null);
  const [tplForm, setTplForm] = useState<TplFormShape>(tplFormInitial);
  const [tplErrors, setTplErrors] = useState<TplFormErrors>({});

  const setTplField = <K extends keyof TplFormShape>(field: K, value: TplFormShape[K]) => {
    const next = { ...tplForm, [field]: value };
    setTplForm(next);
    setTplErrors(validateTplForm(next));
  };

  const openCreateTpl = () => {
    if (isTplAtLimit) {
      addToast({ title: `通知模版最多支持 ${MAX_TEMPLATES} 条`, color: 'warning' });
      return;
    }
    setEditingTpl(null);
    setTplForm(tplFormInitial);
    setTplErrors({});
    setTplModalOpen(true);
  };

  const openEditTpl = (tpl: NotifyTemplate) => {
    setEditingTpl(tpl);
    const form: TplFormShape = {
      name: tpl.name ?? '',
      type: tpl.type,
      platform: tpl.platform,
      templateId: tpl.templateId ?? '',
      contentExample: tpl.contentExample ?? '',
      enabled: tpl.enabled ?? true,
    };
    setTplForm(form);
    // 已落库的数据视为合法,只更新 form,不预先标红
    setTplErrors({});
    setTplModalOpen(true);
  };

  const closeTplDrawer = () => {
    setTplModalOpen(false);
    setTplErrors({});
  };

  const saveTplUI = useApiMutation({
    mutationFn: (data: Partial<NotifyTemplate>) => saveNotifyTemplate(data),
  });

  const deleteTplUI = useApiMutation({
    mutationFn: (id: string) => deleteNotifyTemplate(id),
  });

  const handleSaveTpl = () => {
    const errors = validateTplForm(tplForm);
    if (Object.keys(errors).length > 0) {
      setTplErrors(errors);
      addToast({ title: '请检查表单填写', color: 'warning' });
      return;
    }
    saveTplUI.mutate(
      {
        ...(editingTpl ? { id: editingTpl.id } : {}),
        name: tplForm.name.trim(),
        type: tplForm.type,
        platform: tplForm.platform,
        templateId: tplForm.templateId.trim(),
        contentExample: tplForm.contentExample,
        enabled: tplForm.enabled,
      },
      {
        onSuccess: () => {
          addToast({ title: editingTpl ? '模版已更新' : '模版已创建', color: 'success' });
          closeTplDrawer();
          queryClient.invalidateQueries({ queryKey: ['notifyTemplates'] });
        },
        onError: (err: Error) =>
          addToast({ title: editingTpl ? '更新失败' : '创建失败', description: err.message, color: 'danger' }),
      },
    );
  };

  const tplHasErrors = useMemo(() => Object.keys(validateTplForm(tplForm)).length > 0, [tplForm]);

  // ═══════ 渲染 ═══════
  return (
    <div className="flex min-h-full flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">通知</h1>
      </header>

      {/* ── 1. 通知用户(默认折叠) ── */}
      <section className="rounded-2xl bg-content1 p-4">
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setUserExpanded((v) => !v)}
            className="flex flex-1 items-center gap-2 text-left"
            aria-expanded={userExpanded}
          >
            <Chip size="sm" variant="flat" color={isUserAtLimit ? 'warning' : 'default'}>
              {visibleUsers.length} / {MAX_USERS}
            </Chip>
            <h2 className="text-base font-medium text-foreground">通知用户</h2>
            {!userExpanded && (
              <span className="truncate text-xs text-foreground-500">
                {visibleUsers.length === 0
                  ? '尚未添加'
                  : visibleUsers.map((u) => u.name).join('、')}
              </span>
            )}
            {userExpanded
              ? <ChevronUpIcon className="ml-1 h-4 w-4 text-foreground-500" />
              : <ChevronDownIcon className="ml-1 h-4 w-4 text-foreground-500" />}
          </button>
        </div>

        {userExpanded && (usersLoading ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: MAX_USERS }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: MAX_USERS }).map((_, i) => {
              const user = visibleUsers[i];
              if (!user) {
                return (
                  <button
                    key={`empty-${i}`}
                    type="button"
                    onClick={openCreateUser}
                    className="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-divider text-foreground-400 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                  >
                    <PlusIcon className="h-6 w-6" />
                    <span className="text-xs">添加用户</span>
                  </button>
                );
              }
              const isOn = user.enabled ?? true;
              return (
                <div
                  key={user.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`编辑通知用户 ${user.name}`}
                  onClick={() => openEditUser(user)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openEditUser(user);
                    }
                  }}
                  className="flex h-32 cursor-pointer flex-col justify-between rounded-xl border border-divider bg-content2 p-3 transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{user.name}</div>
                      <div className="truncate text-xs text-foreground-500">{user.phone}</div>
                    </div>
                    <Chip size="sm" variant="flat" color={isOn ? 'success' : 'default'} className="shrink-0">
                      {isOn ? '开' : '关'}
                    </Chip>
                  </div>
                  <div className="flex items-center gap-1 border-t border-divider pt-2">
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="light" color="primary"
                        onPointerDown={(e) => e.stopPropagation()}
                        onPress={() => openEditUser(user)}
                        startContent={<PencilIcon className="h-3.5 w-3.5" />}>
                        编辑
                      </Button>
                      <Popover placement="top">
                        <PopoverTrigger>
                          <Button size="sm" variant="light" color="danger"
                            onPointerDown={(e) => e.stopPropagation()}
                            startContent={<TrashIcon className="h-3.5 w-3.5" />}>
                            删除
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent>
                          <div className="flex flex-col items-center gap-2 p-2">
                            <p className="text-sm text-foreground">确认删除「{user.name}」?</p>
                            <Button size="sm" color="danger" isLoading={deleteUserUI.isPending}
                              onPress={() => deleteUserUI.mutate(user.id, {
                                onSuccess: () => {
                                  addToast({ title: '删除成功', color: 'success' });
                                  queryClient.invalidateQueries({ queryKey: ['notifyUsers'] });
                                },
                                onError: (err: Error) =>
                                  addToast({ title: '删除失败', description: err.message, color: 'danger' }),
                              })}>
                              确认删除
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {/* ── 2. 通知模版(默认折叠) ── */}
      <section className="rounded-2xl bg-content1 p-4">
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setTplExpanded((v) => !v)}
            className="flex flex-1 items-center gap-2 text-left"
            aria-expanded={tplExpanded}
          >
            <Chip size="sm" variant="flat" color={isTplAtLimit ? 'warning' : 'default'}>
              {visibleTemplates.length} / {MAX_TEMPLATES}
            </Chip>
            <h2 className="text-base font-medium text-foreground">通知模版</h2>
            {!tplExpanded && (
              <span className="truncate text-xs text-foreground-500">
                {visibleTemplates.length === 0
                  ? '尚未添加'
                  : visibleTemplates.map((t) => `${t.name}(${t.type})`).join('、')}
              </span>
            )}
            {tplExpanded
              ? <ChevronUpIcon className="ml-1 h-4 w-4 text-foreground-500" />
              : <ChevronDownIcon className="ml-1 h-4 w-4 text-foreground-500" />}
          </button>
        </div>

        {tplExpanded && (templatesLoading ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: MAX_TEMPLATES }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {visibleTemplates.map((tpl) => {
              const typeLabel = TYPE_OPTIONS.find((o) => o.key === tpl.type)?.label ?? tpl.type;
              const platformLabel = PLATFORM_OPTIONS.find((o) => o.key === tpl.platform)?.label ?? tpl.platform;
              return (
                <div
                  key={tpl.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`编辑通知模版 ${tpl.name}`}
                  onClick={() => openEditTpl(tpl)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openEditTpl(tpl);
                    }
                  }}
                  className="flex h-32 cursor-pointer flex-col justify-between rounded-xl border border-divider bg-content2 p-3 transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground" title={tpl.name}>{tpl.name}</div>
                      <div className="truncate text-xs text-foreground-500" title={`${typeLabel} · ${platformLabel}`}>
                        {typeLabel} · {platformLabel}
                      </div>
                    </div>
                    <Chip size="sm" variant="flat" color={tpl.enabled ? 'success' : 'default'} className="shrink-0">
                      {tpl.enabled ? '开' : '关'}
                    </Chip>
                  </div>
                  <div className="flex items-center gap-1 border-t border-divider pt-2">
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="light" color="primary"
                        onPointerDown={(e) => e.stopPropagation()}
                        onPress={() => openEditTpl(tpl)}
                        startContent={<PencilIcon className="h-3.5 w-3.5" />}>
                        编辑
                      </Button>
                      <Popover placement="top">
                        <PopoverTrigger>
                          <Button size="sm" variant="light" color="danger"
                            onPointerDown={(e) => e.stopPropagation()}
                            startContent={<TrashIcon className="h-3.5 w-3.5" />}>
                            删除
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent>
                          <div className="flex flex-col items-center gap-2 p-2">
                            <p className="text-sm text-foreground">确认删除模版「{tpl.name}」?</p>
                            <Button size="sm" color="danger" isLoading={deleteTplUI.isPending}
                              onPress={() => deleteTplUI.mutate(tpl.id, {
                                onSuccess: () => {
                                  addToast({ title: '模版已删除', color: 'success' });
                                  queryClient.invalidateQueries({ queryKey: ['notifyTemplates'] });
                                },
                                onError: (err: Error) =>
                                  addToast({ title: '删除失败', description: err.message, color: 'danger' }),
                              })}>
                              确认删除
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* 不足 6 个时显示空槽位,与用户完全一致 */}
            {Array.from({ length: Math.max(0, MAX_TEMPLATES - visibleTemplates.length) }).map((_, i) => (
              <button
                key={`empty-${i}`}
                type="button"
                onClick={openCreateTpl}
                className="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-divider text-foreground-400 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
              >
                <PlusIcon className="h-6 w-6" />
                <span className="text-xs">添加模版</span>
              </button>
            ))}
          </div>
        ))}
      </section>

      {/* ── 3. 通知记录(主展示,标准表格) ── */}
      <section className="rounded-2xl bg-content1 p-4">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-foreground">通知记录</h2>
            <span className="text-xs text-foreground-500">共 {recordsTotal} 条</span>
          </div>
        </header>

        {/* 通用搜索/排序/筛选/重置 工具栏 */}
        <div className="mb-3">
          <SearchFilterBar
            searchPlaceholder="搜索事件"
            searchValue={recordSearch}
            onSearchChange={setRecordSearch}
            sort={{
              fields: [
                { key: 'time', label: '发送时间' },
                { key: 'status', label: '发送状态' },
                { key: 'channel', label: '渠道' },
              ],
              value: recordSort,
              onChange: (k: string) => setRecordSort(k as RecordSortField),
              dir: recordDir,
              onDirChange: setRecordDir,
            }}
            filters={[
              {
                label: '渠道',
                value: recordChannel,
                options: RECORD_CHANNEL_OPTIONS,
                onChange: (v) => setRecordChannel(v as 'ALL' | NotifyChannel),
              },
              {
                label: '发送状态',
                value: recordStatus,
                options: RECORD_STATUS_OPTIONS,
                onChange: (v) => setRecordStatus(v as 'ALL' | NotifyRecordStatus),
              },
            ] satisfies FilterGroupSpec[]}
            onReset={() => {
              setRecordSearch('');
              setRecordChannel('ALL'); setRecordStatus('ALL');
              setRecordSort('time'); setRecordDir('DESC');
            }}
          />
        </div>

        {recordsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        ) : isMobile ? (
          records.length === 0 ? (
            <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
              暂无通知记录
            </div>
          ) : (
            <div className="masonry">
              {records.map((r) => (
                <EntityCard
                  key={r.id}
                  title={
                    <span className="line-clamp-2" title={r.event}>
                      {r.event}
                    </span>
                  }
                  subtitle={formatDateTime(r.time)}
                  badge={
                    <Chip size="sm" variant="flat">{CHANNEL_LABELS[r.channel ?? ''] ?? r.channel ?? '-'}</Chip>
                  }
                >
                  <FieldRow label="通知人" value={
                    (r.notifyUserIds ?? [])
                      .map((id: string) => userNameById.get(id) ?? id.slice(0, 8))
                      .join('、') || '-'
                  } />
                  <FieldRow label="内容" value={
                    <span className="line-clamp-2 text-xs text-foreground-600" title={r.content}>
                      {r.content || '-'}
                    </span>
                  } />
                </EntityCard>
              ))}
            </div>
          )
        ) : (
          <Table aria-label="通知记录" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
            <TableHeader>
              <TableColumn>时间</TableColumn>
              <TableColumn>事件</TableColumn>
              <TableColumn>渠道</TableColumn>
              <TableColumn>通知人</TableColumn>
              <TableColumn>内容</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无通知记录" items={records}>
              {(r: NotifyRecord) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className="text-xs text-foreground-600">{formatDateTime(r.time)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="line-clamp-2 text-sm text-foreground" title={r.event}>
                      {r.event}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat">{CHANNEL_LABELS[r.channel ?? ''] ?? r.channel ?? '-'}</Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-foreground-600">
                      {(r.notifyUserIds ?? [])
                        .map((id: string) => userNameById.get(id) ?? id.slice(0, 8))
                        .join('、') || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="line-clamp-2 text-xs text-foreground-600" title={r.content}>
                      {r.content || '-'}
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {/* 分页(与设备管理一致) */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Select size="sm" variant="bordered" className="w-24"
              selectedKeys={[String(recordsSize)]}
              onSelectionChange={(keys) => setRecordsSize(Number(Array.from(keys)[0]))}>
              {['15', '30', '60', '100'].map((s) => (
                <SelectItem key={s}>{s}</SelectItem>
              ))}
            </Select>
          </div>
          <Pagination
            total={Math.max(1, Math.ceil(recordsTotal / recordsSize))}
            page={recordsPage + 1}
            onChange={(p) => setRecordsPage(p - 1)}
            showControls isCompact
          />
        </div>
      </section>

      {/* ═══════ 通知用户 Drawer(新增/编辑) ═══════ */}
      <Drawer isOpen={userDrawerOpen} onOpenChange={(open) => open ? setUserDrawerOpen(true) : closeUserDrawer()} placement="right" size="lg">
        <DrawerContent>
          <DrawerHeader>{editingUser ? '编辑用户' : '新增用户'}</DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            <Input label="名称" placeholder="请输入姓名" value={userForm.name}
              onValueChange={(v) => setUserField('name', v)}
              variant="bordered" isRequired
              isInvalid={!!userErrors.name}
              errorMessage={userErrors.name}
              maxLength={MAX_NAME_LEN}
              description={`${userForm.name.length} / ${MAX_NAME_LEN}`} />
            <Input label="手机号" placeholder="如 13800138000 或 +86 138 0013 8000"
              value={userForm.phone}
              onValueChange={(v) => setUserField('phone', v)}
              variant="bordered" isRequired
              isInvalid={!!userErrors.phone}
              errorMessage={userErrors.phone}
              maxLength={20}
              inputMode="tel"
              description="支持国内 11 位或国际号码(+国家码),允许空格/短横线分隔" />
            <Switch isSelected={userForm.smsEnabled}
              onValueChange={(v) => setUserField('smsEnabled', v)}>
              短信通知
            </Switch>
            <Switch isSelected={userForm.enabled}
              onValueChange={(v) => setUserField('enabled', v)}>
              通知开关
            </Switch>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="flat" onPress={closeUserDrawer}>取消</Button>
            <Button color="primary" isLoading={saveUserUI.isPending}
              isDisabled={userHasErrors} onPress={handleSaveUser}>保存</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ═══════ 通知模版 Drawer(新增/编辑) ═══════ */}
      <Drawer isOpen={tplModalOpen} onOpenChange={(open) => open ? setTplModalOpen(true) : closeTplDrawer()} placement="right" size="2xl">
        <DrawerContent>
          <DrawerHeader>{editingTpl ? '编辑模版' : '新增模版'}</DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            <Input label="模版名称" placeholder="如：温度过高告警"
              value={tplForm.name}
              onValueChange={(v) => setTplField('name', v)}
              variant="bordered" isRequired
              isInvalid={!!tplErrors.name}
              errorMessage={tplErrors.name}
              maxLength={MAX_NAME_LEN}
              description={`${tplForm.name.length} / ${MAX_NAME_LEN}`} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="类型" variant="bordered" isRequired
                selectedKeys={[tplForm.type]}
                onSelectionChange={(keys) =>
                  setTplField('type', Array.from(keys)[0] as TplFormShape['type'])}>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.key}>{o.label}</SelectItem>
                ))}
              </Select>
              <Select label="平台" variant="bordered" isRequired
                selectedKeys={[tplForm.platform]}
                onSelectionChange={(keys) =>
                  setTplField('platform', Array.from(keys)[0] as TplFormShape['platform'])}>
                {PLATFORM_OPTIONS.map((o) => (
                  <SelectItem key={o.key}>{o.label}</SelectItem>
                ))}
              </Select>
            </div>
            <Input label="三方模版ID" placeholder="在三方平台上注册的模版 ID"
              value={tplForm.templateId}
              onValueChange={(v) => setTplField('templateId', v)}
              variant="bordered" isRequired
              isInvalid={!!tplErrors.templateId}
              errorMessage={tplErrors.templateId}
              maxLength={MAX_TPL_ID_LEN}
              description={`${tplForm.templateId.length} / ${MAX_TPL_ID_LEN}`} />
            <Textarea
              label="内容示例"
              placeholder="支持 ${varName} 占位符,如:设备 ${deviceName} 温度 ${value}°C 超限"
              value={tplForm.contentExample}
              onValueChange={(v) => setTplField('contentExample', v)}
              variant="bordered" isRequired
              isInvalid={!!tplErrors.contentExample}
              errorMessage={tplErrors.contentExample}
              minRows={3}
              maxLength={MAX_CONTENT_LEN}
              description={`${tplForm.contentExample.length} / ${MAX_CONTENT_LEN},实际下发时由后端根据事件参数替换 \${...} 占位符`} />
            <Switch isSelected={tplForm.enabled}
              onValueChange={(v) => setTplField('enabled', v)}>
              启用模版
            </Switch>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="flat" onPress={closeTplDrawer}>取消</Button>
            <Button color="primary" isLoading={saveTplUI.isPending}
              isDisabled={tplHasErrors} onPress={handleSaveTpl}>保存</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
