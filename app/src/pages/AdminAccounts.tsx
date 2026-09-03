import {
  Button, Chip, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader,
  Input, Pagination, Select, SelectItem,
  Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
  Tooltip, addToast,
} from '@heroui/react';
import { PlusIcon, TrashIcon, PowerIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useQueryList } from '@/hooks/useQueryList';
import SearchFilterBar from '@/components/list/SearchFilterBar';
import {
  createAccount, deleteAccount, queryAccounts, countAccounts, setAccountEnabled,
  getAccount,
  type AccountCreateReq,
} from '@/api/admin';
import { formatDateTime } from '@/lib/format';
import type { Account, AccountDetail } from '@/types/api';

const QUERY_KEY = 'adminAccounts';

const ROLE_OPTIONS = [
  { key: 'SUPER_ADMIN', label: '超级管理员' },
  { key: 'ADMIN', label: '管理员' },
  { key: 'OPERATOR', label: '操作员' },
  { key: 'VIEWER', label: '观察者' },
];

export default function AdminAccounts() {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [sortField, setSortField] = useState<'createdAt' | 'lastLoginAt' | 'username'>('createdAt');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

  const list = useQueryList<Account>({
    queryKey: QUERY_KEY,
    queryFn: queryAccounts,
    countFn: countAccounts,
    defaultSize: 15,
    defaultPredicate: keyword.trim()
      ? { and: [{ condition: { field: 'username', op: 'like', value: `%${keyword.trim()}%` } }] }
      : undefined,
    defaultOrder: [{ field: sortField, order: sortDir }],
  });

  useEffect(() => {
    list.setPredicate(keyword.trim()
      ? { and: [{ condition: { field: 'username', op: 'like', value: `%${keyword.trim()}%` } }] }
      : undefined);
  }, [keyword]);
  useEffect(() => {
    list.setOrder([{ field: sortField, order: sortDir }]);
  }, [sortField, sortDir]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<AccountCreateReq>({
    tenantId: '0', username: '', displayName: '', password: '', roles: ['OPERATOR'],
  });

  const createUI = useApiMutation({ mutationFn: (r: AccountCreateReq) => createAccount(r) });
  const toggleUI = useApiMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setAccountEnabled(id, enabled),
  });
  const deleteUI = useApiMutation({ mutationFn: (id: string) => deleteAccount(id) });

  // 详情 Drawer
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const loadDetail = (id: string) => {
    new Promise<AccountDetail>((resolve, reject) => {
      getAccount(id).onSuccess((d) => resolve(d))
        .onBizError((err) => reject(err))
        .onHttpError((err) => reject(err))
        .execute();
    }).then(setDetail).catch(() => setDetail(null));
  };
  const openDetail = (a: Account) => { loadDetail(a.id); setDetailOpen(true); };

  const doToggle = (a: Account, enabled: boolean) => {
    if (a.username === 'admin') {
      addToast({ title: '不能禁用 admin', color: 'warning' });
      return;
    }
    toggleUI.mutate({ id: a.id, enabled }, {
      onSuccess: () => {
        addToast({ title: enabled ? '已启用' : '已停用', color: 'success' });
        list.refetch(); qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      },
    });
  };

  const doDelete = (a: Account) => {
    if (a.username === 'admin') { addToast({ title: '不能删除 admin', color: 'warning' }); return; }
    if (!window.confirm(`确认删除账号 "${a.username}" ?`)) return;
    deleteUI.mutate(a.id, {
      onSuccess: () => {
        addToast({ title: '已删除', color: 'success' });
        list.refetch(); qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      },
    });
  };

  const openCreate = () => {
    setForm({ tenantId: '0', username: '', displayName: '', password: '', roles: ['OPERATOR'] });
    setCreateOpen(true);
  };

  const submitCreate = () => {
    if (!form.username.trim() || !form.password.trim() || !form.tenantId.trim()) {
      addToast({ title: '必填字段缺失', color: 'warning' }); return;
    }
    createUI.mutate(form, {
      onSuccess: () => {
        addToast({ title: '已创建', color: 'success' });
        setCreateOpen(false);
        list.refetch(); qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">账户管理</h1>
          <p className="text-sm text-foreground/60">
            仅 SUPER_ADMIN 可操作。多租户授权在租户详情抽屉管理。
          </p>
        </div>
        <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={openCreate}>
          新建账号
        </Button>
      </div>

      <SearchFilterBar
        searchPlaceholder="搜索用户名"
        searchValue={keyword}
        onSearchChange={setKeyword}
        sort={{
          fields: [
            { key: 'createdAt', label: '创建时间' },
            { key: 'lastLoginAt', label: '最后登录' },
            { key: 'username', label: '用户名' },
          ],
          value: sortField,
          onChange: (v) => setSortField(v as typeof sortField),
          dir: sortDir,
          onDirChange: setSortDir,
        }}
        onReset={() => { setKeyword(''); setSortField('createdAt'); setSortDir('DESC'); }}
      />

      <div className="rounded-lg border border-divider bg-content1">
        <Table aria-label="账号列表" removeWrapper>
          <TableHeader>
            <TableColumn>用户名</TableColumn>
            <TableColumn>显示名</TableColumn>
            <TableColumn>主租户</TableColumn>
            <TableColumn>角色</TableColumn>
            <TableColumn>状态</TableColumn>
            <TableColumn>最后登录</TableColumn>
            <TableColumn className="text-right">操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent={list.isLoading ? '加载中…' : '暂无数据'}>
            {(list.data ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono">{a.username}</TableCell>
                <TableCell>{a.displayName ?? '—'}</TableCell>
                <TableCell><Chip size="sm" variant="flat">{a.tenantId ?? '—'}</Chip></TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(a.roles ?? []).map((r) => (
                      <Chip key={r} size="sm" variant="dot"
                            color={r === 'SUPER_ADMIN' ? 'danger' : 'primary'}>{r}</Chip>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Chip size="sm" color={a.enabled ? 'success' : 'default'} variant="flat">
                    {a.enabled ? '启用' : '停用'}
                  </Chip>
                </TableCell>
                <TableCell className="text-sm text-foreground/60">
                  {a.lastLoginAt ? formatDateTime(a.lastLoginAt) : '从未'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Tooltip content="详情 / 关联租户">
                      <Button isIconOnly size="sm" variant="flat" color="primary"
                              onPress={() => openDetail(a)}>
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={a.enabled ? '停用' : '启用'}>
                      <Button isIconOnly size="sm" variant="flat"
                              color={a.enabled ? 'warning' : 'success'}
                              isLoading={toggleUI.isPending}
                              onPress={() => doToggle(a, !a.enabled)}>
                        <PowerIcon className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="删除">
                      <Button isIconOnly size="sm" variant="flat" color="danger"
                              isLoading={deleteUI.isPending}
                              onPress={() => doDelete(a)}>
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-divider px-3 py-2 text-sm">
          <div>共 {list.total} 条 · 第 {list.page + 1} / {list.totalPages} 页</div>
          <Pagination total={list.totalPages} page={list.page + 1}
                      onChange={(p) => list.setPage(p - 1)} showControls size="sm" />
        </div>
      </div>

      {/* 创建账号 Drawer */}
      <Drawer isOpen={createOpen} onOpenChange={setCreateOpen} placement="right" size="lg">
        <DrawerContent>
          <DrawerHeader>新建账号</DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            <Input label="用户名" placeholder="3-64 位" value={form.username}
                   onValueChange={(v) => setForm({ ...form, username: v.trim() })}
                   variant="bordered" isRequired />
            <Input label="显示名" value={form.displayName ?? ''}
                   onValueChange={(v) => setForm({ ...form, displayName: v })}
                   variant="bordered" />
            <Input label="主租户 ID" value={form.tenantId}
                   description="默认租户 0；如需分配到其他租户，请在创建后到'租户管理'详情里关联。"
                   variant="bordered" isDisabled />
            <Input label="初始密码" type="password" placeholder="≥ 6 位" value={form.password}
                   onValueChange={(v) => setForm({ ...form, password: v })}
                   variant="bordered" isRequired />
            <Select label="角色" variant="bordered" selectionMode="multiple"
                    selectedKeys={new Set(form.roles ?? [])}
                    onSelectionChange={(keys) => {
                      const arr = Array.from(keys).map(String);
                      setForm({ ...form, roles: arr });
                    }}>
              {ROLE_OPTIONS.map((o) => <SelectItem key={o.key}>{o.label}</SelectItem>)}
            </Select>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="flat" onPress={() => setCreateOpen(false)}>取消</Button>
            <Button color="primary" isLoading={createUI.isPending} onPress={submitCreate}>保存</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 详情 Drawer — 包含关联租户列表 */}
      <Drawer isOpen={detailOpen} onOpenChange={setDetailOpen}
              placement="right" size="2xl">
        <DrawerContent>
          <DrawerHeader>
            账号详情 · {detail?.account.username ?? '加载中'}
          </DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            {!detail ? (
              <p className="text-sm text-foreground/60">加载中…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-foreground/60">用户名</span> · <span className="font-mono">{detail.account.username}</span></div>
                  <div><span className="text-foreground/60">显示名</span> · {detail.account.displayName ?? '—'}</div>
                  <div><span className="text-foreground/60">主租户</span> · <span className="font-mono">{detail.account.tenantId ?? '—'}</span></div>
                  <div><span className="text-foreground/60">状态</span> · {(detail.account.enabled ?? true) ? '启用' : '停用'}</div>
                  <div><span className="text-foreground/60">最后登录</span> · {detail.account.lastLoginAt ? formatDateTime(detail.account.lastLoginAt) : '从未'}</div>
                  <div>
                    <span className="text-foreground/60">角色</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(detail.account.roles ?? []).map((r) => (
                        <Chip key={r} size="sm" variant="dot">{r}</Chip>
                      ))}
                    </div>
                  </div>
                </div>

                <h3 className="mt-2 text-sm font-semibold">
                  关联租户 ({detail.linkedTenants.length})
                </h3>
                {detail.linkedTenants.length === 0 ? (
                  <p className="text-sm text-foreground/60">
                    该账号尚未关联到任何租户（仅主租户"默认 0"）。到"租户管理"详情里关联。
                  </p>
                ) : (
                  <Table aria-label="关联租户" removeWrapper>
                    <TableHeader>
                      <TableColumn>短代码</TableColumn>
                      <TableColumn>显示名</TableColumn>
                      <TableColumn>状态</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {detail.linkedTenants.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono">{t.code}</TableCell>
                          <TableCell>{t.name ?? '—'}</TableCell>
                          <TableCell>
                            <Chip size="sm"
                                  color={(t.enabled ?? true) ? 'success' : 'default'}
                                  variant="flat">
                              {(t.enabled ?? true) ? '启用' : '停用'}
                            </Chip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button variant="flat" onPress={() => setDetailOpen(false)}>关闭</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}