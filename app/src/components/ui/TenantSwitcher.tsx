import {useEffect, useState} from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Radio,
  RadioGroup,
  Spinner,
} from '@heroui/react';
import {toastError, toastSuccess, toastWarning} from '@/lib/toast';
import {type AvailableTenant, fetchAvailableTenants, switchTenant,} from '@/services/authService';
import {useAuthStore} from '@/stores/authStore';

interface TenantSwitcherProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 右上角"切换租户"弹框
 *
 * <p>流程:
 * <ol>
 *   <li>打开时拉取 GET /api/auth/tenants 列出该账号可用租户;</li>
 *   <li>用户选中目标租户,点击"切换";</li>
 *   <li>调 POST /api/auth/refresh 携带 targetTenantId;</li>
 *   <li>成功后 setTokens + window.location.reload() 刷新全页面。</li>
 * </ol>
 */
export default function TenantSwitcher({ isOpen, onOpenChange }: TenantSwitcherProps) {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setTenantId = useAuthStore((s) => s.setTenantId);

  const [tenants, setTenants] = useState<AvailableTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSelected(null);
    fetchAvailableTenants({
      onSuccess: (data) => {
        setTenants(Array.isArray(data) ? data : []);
        // 默认选中当前租户(若有)
        const cur = (data ?? []).find((t) => t.current);
        setSelected(cur?.id ?? data?.[0]?.id ?? null);
      },
        onBizError: () => {
            setTenants([]);
            setLoading(false);
        },
        onHttpError: () => {
            setTenants([]);
            setLoading(false);
        },
    });
    // 这里故意不让 fetchAvailableTenants 的返回值参与 deps,它自身稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSwitch = () => {
    if (!selected) return;
    if (!refreshToken) {
        toastWarning('登录状态已失效,请重新登录');
      return;
    }
    setSwitching(true);
    // 走 POST /auth/login(loginType=REFRESH) 触发 UserRefreshTokenAuthenticationProvider
    switchTenant(
      refreshToken,
      selected,
      {
        onSuccess: (data) => {
          if (data?.accessToken && data?.refreshToken) {
            setTokens(data.accessToken, data.refreshToken);
            setTenantId(selected!);
              toastSuccess('租户已切换,正在刷新页面...');
            // 简单粗暴:全页面刷新,所有订阅/缓存全部重连
            setTimeout(() => window.location.reload(), 200);
          } else {
            setSwitching(false);
              toastError('切换失败,响应数据异常');
          }
        },
        onBizError: () => setSwitching(false),
        onHttpError: () => setSwitching(false),
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
      backdrop="opaque"
      size="md"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">切换租户</ModalHeader>
            <ModalBody>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spinner label="加载租户列表..." />
                </div>
              ) : tenants.length === 0 ? (
                <p className="text-sm text-foreground-500">
                  当前账号未关联任何可用租户,请联系管理员授权。
                </p>
              ) : (
                <RadioGroup
                  value={selected ?? ''}
                  onValueChange={setSelected}
                  aria-label="选择目标租户"
                >
                  {tenants.map((t) => (
                    <Radio
                      key={t.id}
                      value={t.id}
                      description={t.code}
                      classNames={{ base: 'max-w-full' }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t.name || t.code}</span>
                        {t.current && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                            当前
                          </span>
                        )}
                      </div>
                    </Radio>
                  ))}
                </RadioGroup>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose} isDisabled={switching}>
                取消
              </Button>
              <Button
                color="primary"
                onPress={handleSwitch}
                isLoading={switching}
                isDisabled={!selected || tenants.length === 0}
              >
                切换
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}