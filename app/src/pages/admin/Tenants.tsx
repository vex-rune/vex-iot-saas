import {
  Button, Chip, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader,
  Input, Pagination, Switch, Table, TableBody, TableCell, TableColumn,
  TableHeader, TableRow, Tooltip, Textarea, addToast,
} from '@heroui/react';
import { PlusIcon, TrashIcon, PencilIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/useApiMutation';
import { useQueryList } from '@/hooks/common/useQueryList';
import SearchFilterBar from '@/components/ui/common/SearchFilterBar';
import {
  createTenant, updateTenant, deleteTenant,
  queryTenants, countTenants,
  getTenantDetail, linkTenantAccounts, unlinkTenantAccounts,
  type TenantUpsertReq,
} from '@/services/admin';
import type { Tenant, TenantDetail, Account } from '@/types/api';

const QUERY_KEY = 'adminTenants';
const DEFAULT_TENANT_ID = '0';

export default function AdminTenants() {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [sortField, setSortField] = useState<'code' | 'name' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

  const list = useQueryList<Tenant>({
    queryKey: QUERY_KEY,
    queryFn: queryTenants,
    countFn: countTenants,
    defaultSize: 15,
    defaultPredicate: keyword.trim()
      ? { and: [{ condition: { field: 'code', op: 'like', value: `%${keyword.trim()}%` } }] }
      : undefined,
    defaultOrder: [{ field: sortField, order: sortDir }],
  });
  // 搜索/排序变化由 useQueryList 内部自动同步,无需额外 effect

  // 编辑 Drawer 状态
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TenantUpsertReq>({
    code: '', name: '', description: '', enabled: true,
  });
  const createUI = useApiMutation({ mutationFn: (r: TenantUpsertReq) => createTenant(r) });
  const updateUI = useApiMutation({
    mutationFn: ({ id, req }: { id: string; req: TenantUpsertReq }) => updateTenant(id, req),
  });
  const deleteUI = useApiMutation({ mutationFn: (id: string) => deleteTenant(id) });
  const openCreate = () => {
    setForm({ code: '', name: '', description: '', enabled: true });
    setEditTarget(null); setCreateOpen(true);
  };
  const openEdit = (t: Tenant) => {
    setForm({ code: t.code, name: t.name ?? '', description: t.description ?? '', enabled: t.enabled ?? true });
    setEditTarget(t); setCreateOpen(true);
  };
  const submit = () => {
    if (!form.code.trim()) { addToast({ title: '短代码不能为空', color: 'warning' }); return; }
    if (editTarget) {
      updateUI.mutate({ id: editTarget.id, req: form }, {
        onSuccess: () => {
          addToast({ title: '已更新', color: 'success' });
          setCreateOpen(false);
          list.refetch(); qc.invalidateQueries({ queryKey: [QUERY_KEY] });
        },
      });
    } else {
      createUI.mutate(form, {
        onSuccess: () => {
          addToast({ title: '已创建', color: 'success' });
          setCreateOpen(false);
          list.refetch(); qc.invalidateQueries({ queryKey: [QUERY_KEY] });
        },
      });
    }
  };
  const doDelete = (t: Tenant) => {
    if (t.id === DEFAULT_TENANT_ID) {
      addToast({ title: '不能删除默认租户', color: 'warning' }); return;
    }
    if (!window.confirm(`确认删除租户 "${t.code}" ?`)) return;
    deleteUI.mutate(t.id, {
      onSuccess: () => {
        addToast({ title: '已删除', color: 'success' });
        list.refetch(); qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      },
    });
  };

  // 详情 Drawer 状态
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const loadDetail = (id: string) => {
    new Promise<TenantDetail>((resolve, reject) => {
      getTenantDetail(id).onSuccess((d) => resolve(d))
        .onBizError(reject).onHttpError(reject).execute();
    }).then(setDetail).catch(() => setDetail(null));
  };
  const openDetail = (t: Tenant) => { loadDetail(t.id); setDetailOpen(true); };
  const linkUI = useApiMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      linkTenantAccounts(id, userIds),
  });
  const unlinkUI = useApiMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      unlinkTenantAccounts(id, userIds),
  });
  void linkUI; // 引用保留: 后续"关联已有账号"会调用 .mutate(...)
  const doUnlink = (a: Account) => {
    if (!detail) return;
    unlinkUI.mutate({ id: detail.tenant.id, userIds: [a.id] }, {
      onSuccess: () => {
        addToast({ title: '已解除', color: 'success' });
        loadDetail(detail.tenant.id);
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">租户管理</h1>
          <p className="text-sm text-foreground/60">
            仅 SUPER_ADMIN 可操作。被禁用的租户下账号登录会被拦截。
          </p>
        </div>
        <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={openCreate}>
          新建租户
        </Button>
      </div>

      <SearchFilterBar
        searchPlaceholder="搜索短代码"
        searchValue={keyword}
        onSearchChange={setKeyword}
        sort={{
          fields: [
            { key: 'createdAt', label: '创建时间' },
            { key: 'code', label: '短代码' },
            { key: 'name', label: '显示名' },
          ],
          value: sortField,
          onChange: (v) => setSortField(v as typeof sortField),
          dir: sortDir,
          onDirChange: setSortDir,
        }}
        onReset={() => { setKeyword(''); setSortField('createdAt'); setSortDir('DESC'); }}
      />

      <div className="rounded-lg border border-divider bg-content1">
        <Table aria-label="租户列表" removeWrapper>
          <TableHeader>
            <TableColumn>短代码</TableColumn>
            <TableColumn>显示名</TableColumn>
            <TableColumn>描述</TableColumn>
            <TableColumn>状态</TableColumn>
            <TableColumn className="text-right">操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent={list.isLoading ? '加载中…' : '暂无数据'}>
            {(list.data ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono">{t.code}</TableCell>
                <TableCell>{t.name ?? '—'}</TableCell>
                <TableCell className="max-w-md truncate text-sm text-foreground/60">
                  {t.description ?? '—'}
                </TableCell>
                <TableCell>
                  <Chip size="sm"
                        color={(t.enabled ?? true) ? 'success' : 'default'}
                        variant="flat">
                    {(t.enabled ?? true) ? '启用' : '停用'}
                    {t.id === DEFAULT_TENANT_ID && <span className="ml-1 text-xs">(默认)</span>}
                  </Chip>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Tooltip content="详情 / 关联账号">
                      <Button isIconOnly size="sm" variant="flat" color="primary"
                              onPress={() => openDetail(t)}>
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="编辑">
                      <Button isIconOnly size="sm" variant="flat" onPress={() => openEdit(t)}>
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t.id === DEFAULT_TENANT_ID ? '默认租户不可删' : '删除'}>
                      <Button isIconOnly size="sm" variant="flat" color="danger"
                              isDisabled={t.id === DEFAULT_TENANT_ID}
                              isLoading={deleteUI.isPending}
                              onPress={() => doDelete(t)}>
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

      {/* 编辑 Drawer */}
      <Drawer isOpen={createOpen} onOpenChange={setCreateOpen} placement="right" size="lg">
        <DrawerContent>
          <DrawerHeader>{editTarget ? '编辑租户' : '新建租户'}</DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            <Input label="短代码" placeholder="如 demo / tenantA" value={form.code}
                   onValueChange={(v) => setForm({ ...form, code: v.trim() })}
                   variant="bordered" isRequired isDisabled={!!editTarget} />
            <Input label="显示名" value={form.name ?? ''}
                   onValueChange={(v) => setForm({ ...form, name: v })}
                   variant="bordered" />
            <Textarea label="描述" value={form.description ?? ''}
                      onValueChange={(v) => setForm({ ...form, description: v })}
                      variant="bordered" minRows={2} maxLength={512} />
            <Switch isSelected={form.enabled ?? true}
                    onValueChange={(v) => setForm({ ...form, enabled: v })}>
              启用租户
            </Switch>
            {editTarget?.id === DEFAULT_TENANT_ID && (
              <p className="text-xs text-warning">默认租户不支持禁用</p>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button variant="flat" onPress={() => setCreateOpen(false)}>取消</Button>
            <Button color="primary"
                    isLoading={createUI.isPending || updateUI.isPending}
                    onPress={submit}>保存</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 详情 + 关联账号 Drawer */}
      <Drawer isOpen={detailOpen} onOpenChange={setDetailOpen}
              placement="right" size="2xl">
        <DrawerContent>
          <DrawerHeader>租户详情 · {detail?.tenant.code ?? '加载中'}</DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            {!detail ? (
              <p className="text-sm text-foreground/60">加载中…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-foreground/60">ID</span> · <span className="font-mono">{detail.tenant.id}</span></div>
                  <div><span className="text-foreground/60">短代码</span> · <span className="font-mono">{detail.tenant.code}</span></div>
                  <div><span className="text-foreground/60">显示名</span> · {detail.tenant.name ?? '—'}</div>
                  <div><span className="text-foreground/60">状态</span> · {(detail.tenant.enabled ?? true) ? '启用' : '停用'}</div>
                  <div className="col-span-2"><span className="text-foreground/60">描述</span> · {detail.tenant.description ?? '—'}</div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">关联账号 ({detail.accounts.length})</h3>
                  <p className="text-xs text-foreground/60">
                    解除关联不会删除账号本身。
                  </p>
                </div>

                {detail.accounts.length === 0 ? (
                  <p className="text-sm text-foreground/60">
                    暂无关联账号。可在"账户管理"先建账号，然后到"账户详情"维护多租户关联。
                  </p>
                ) : (
                  <Table aria-label="关联账号" removeWrapper>
                    <TableHeader>
                      <TableColumn>用户名</TableColumn>
                      <TableColumn>显示名</TableColumn>
                      <TableColumn>角色</TableColumn>
                      <TableColumn>状态</TableColumn>
                      <TableColumn className="text-right">操作</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {detail.accounts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono">{a.username}</TableCell>
                          <TableCell>{a.displayName ?? '—'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(a.roles ?? []).map((r) => (
                                <Chip key={r} size="sm" variant="dot">{r}</Chip>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip size="sm"
                                  color={(a.enabled ?? true) ? 'success' : 'default'}
                                  variant="flat">
                              {(a.enabled ?? true) ? '启用' : '停用'}
                            </Chip>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="flat" color="danger"
                                    isLoading={unlinkUI.isPending}
                                    onPress={() => doUnlink(a)}>
                              解除
                            </Button>
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