import {useEffect, useState} from 'react';
import {Link, useLocation, useNavigate,} from 'react-router-dom';
import {Button, Divider, Input, InputOtp,} from '@heroui/react';
import {fetchCurrentUser, fetchKeyInfo, login, loginAdmin, type TokenPair} from '@/services/authService';
import type {AuthKeyInfo} from '@/types/api';
import {BizError} from '@/lib/api-client';
import type {AxiosError} from 'axios';
import {useAuthStore} from '@/stores/authStore';
import {
    ArrowTopRightOnSquareIcon,
    CircleStackIcon,
    EyeIcon,
    EyeSlashIcon,
    MoonIcon,
    ShieldCheckIcon,
    SignalIcon,
    SunIcon,
} from '@heroicons/react/24/outline';
import {APP_TITLE, OFFICIAL_SITE, OFFICIAL_URL} from '@/lib/env';
import {useThemeStore} from '@/stores/themeStore';
import {BrandLogo} from '@/components/ui/BrandLogo';
import {toastError, toastSuccess, toastWarning} from '@/lib/toast';

interface LocationState {
    from?: { pathname?: string };
}

interface FeatureItem {
    icon: typeof SignalIcon;
    title: string;
    desc: string;
}

const FEATURES: FeatureItem[] = [
    {icon: SignalIcon, title: '设备在线监控', desc: '全链路心跳保活,3s 刷新在线状态'},
    {icon: ShieldCheckIcon, title: '多级告警引擎', desc: '阈值/区间/BETWEEN 规则,告警必达'},
    {icon: CircleStackIcon, title: '点位历史归档', desc: '按点位查询,默认 500 条快速回放'},
];

/**
 * SHA-256 封装:把任意字符串哈希为 64 位 hex.
 * 浏览器优先用 SubtleCrypto (异步);Subtle 不可用时降级到自定义 hex 实现.
 *
 * 这里返回 Promise<string>;调用处 await.
 */
async function sha256Hex(input: string): Promise<string> {
    // 优先:Web Crypto SubtleCrypto
    if (typeof crypto !== 'undefined' && crypto?.subtle?.digest) {
        const enc = new TextEncoder().encode(input);
        const buf = await crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }
    // 降级:无 crypto.subtle 的极旧浏览器(开发期理论上不会发生)
    // 同步实现仅用于离线/SSR 环境兜底,真实登录不应走这条路径
    let h1 = 0xdeadbeef ^ 0;
    let h2 = 0x41c6ce57 ^ 0;
    for (let i = 0; i < input.length; i++) {
        const ch = input.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const v = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    return v.padStart(16, '0').repeat(4).slice(0, 64);
}

/**
 * 按 openapi v2 约定:
 *   challenge = SHA-256(salt + ":" + windowStart + ":" + password)
 *   signature = SHA-256(salt + ":" + windowStart + ":" + windowSeconds + ":" + password)
 *
 * 当前服务端只校验 signature (challenge 占位).两端算法严格一致才能通过.
 */
async function signCredential(
    password: string,
    info: AuthKeyInfo,
): Promise<{ challenge: string; signature: string }> {
    const {salt, windowStart, windowSeconds} = info;
    const challenge = await sha256Hex(`${salt}:${windowStart}:${password}`);
    const signature = await sha256Hex(`${salt}:${windowStart}:${windowSeconds}:${password}`);
    return {challenge, signature};
}

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const {theme, toggle} = useThemeStore();

    const isAdminMode =
        typeof window !== 'undefined'
        && window.location.pathname.startsWith('/login/admin');

    const [username, setUsername] = useState('');
    const [credential, setCredential] = useState('');
    const [pwdVisible, setPwdVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    // 在两种登录模式之间切换时清空表单, 避免把账密遗留到动态码模式或反过来
    useEffect(() => {
        setUsername('');
        setCredential('');
        setPwdVisible(false);
        setLoading(false);
    }, [isAdminMode]);

    const credentialLabel = isAdminMode ? '动态码' : '密码';
    const credentialPlaceholder = isAdminMode ? '请输入 6 位 TOTP 动态码' : '请输入密码';
    const credentialType = isAdminMode ? 'text' : (pwdVisible ? 'text' : 'password');

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !credential.trim()) {
            toastWarning('请输入用户名和' + credentialLabel);
            return;
        }
        setLoading(true);

        // ───── openapi v2 流程:握手 → 签名 → 登录 ─────
        // 与后端 auth 契约对齐(LoginType 决定 challenge/signature 哪个带值,另一个占位):
        //   USER  : challenge = password, signature = 任意占位; 握手后两端都改用 salt 签名
        //   ADMIN : challenge = 与 username 同占位, signature = 6 位 TOTP 动态码
        //
        // 为向前兼容老后端(key-info 不存在时降级直接送原文):
        const credRaw = credential.trim();
        const trimmedUsername = username.trim();

        const handleLogin = (signed: { challenge: string; signature: string }) => {
            const req = isAdminMode
                ? {
                    username: trimmedUsername,
                    loginType: 'ADMIN' as const,
                    challenge: signed.challenge,
                    signature: signed.signature,
                }
                : {
                    username: trimmedUsername,
                    loginType: 'USER' as const,
                    challenge: signed.challenge,
                    signature: signed.signature,
                };

            const onSuccess = (data: TokenPair) => {
                if (!data || typeof data !== 'object' || !data.accessToken || !data.refreshToken) {
                    toastError('登录响应数据格式异常', '请稍后重试或联系管理员');
                    setLoading(false);
                    return;
                }
                const {setTokens, parseUserFromToken} = useAuthStore.getState();
                setTokens(data.accessToken, data.refreshToken);

                // 1) 同步从 token 解析 fallback user,保证跳转后 AppShell 顶部立刻显示用户名(不等 /me)
                const fallbackUser = parseUserFromToken(data.accessToken);
                if (fallbackUser) {
                    useAuthStore.getState().setUser(fallbackUser);
                }

                const to = (location.state as LocationState | null)?.from?.pathname ?? '/dashboard';
                toastSuccess('登录成功');
                navigate(to, {replace: true});
                setLoading(false);

                // 2) 异步拉取权威 /me 信息(含 nickname),用于覆盖 fallback user
                //    失败时不影响登录主流程,fallback 已经保证页面正常显示
                fetchCurrentUser({
                    onSuccess: (me) => {
                        if (me && typeof me === 'object') {
                            useAuthStore.getState().setUser({
                                userId: String(me.userId ?? ''),
                                username: String(me.username ?? ''),
                                nickname: me.nickname ? String(me.nickname) : undefined,
                                roles: Array.isArray(me.roles) ? me.roles : [],
                                tenantId: me.tenantId ? String(me.tenantId) : undefined,
                            });
                        }
                    },
                    onBizError: () => {
                        // /me 失败:fallback 已经设置过 user,这里仅提示
                        toastWarning('部分用户信息未更新', '基础信息已就绪,详情字段可能缺失');
                    },
                    onHttpError: () => {
                        toastWarning('部分用户信息未更新', '基础信息已就绪,详情字段可能缺失');
                    },
                });
            };

            const onBizError = (err: BizError) => {
                // eslint-disable-next-line no-console
                console.warn('[Login] onBizError fired:', err.envelope);
                // 安全收敛:不再把后端的 message 渲染到 UI 上,避免暴露
                // "账号被禁用 / 中间表 enabled / 租户不可用" 等细粒度状态差异。
                // code 仍保留给开发/排障用。
                toastError(
                    isAdminMode ? '管理员凭证不正确' : '账号或凭证不正确',
                    `请检查后重试  [${err.envelope.code}]`,
                );
                setLoading(false);
            };

            const onHttpError = (err: AxiosError) => {
                const status = err.response?.status ?? 0;
                toastError(
                    '网络请求异常',
                    status === 0
                        ? '无法连接到服务器,请检查网络'
                        : `${err.message || '请稍后重试'}  [HTTP ${status}]`,
                );
                setLoading(false);
            };

            if (isAdminMode) {
                loginAdmin(req, {onSuccess, onBizError, onHttpError});
            } else {
                login(req, {onSuccess, onBizError, onHttpError});
            }
        };

        // 1) fetchKeyInfo 优先;若服务返回 404/envelope.code='endpoint_not_found',
        //    降级直接把 challenge=credRaw signature=credRaw 送过去(老后端兼容).
        //
        // 单飞:fetchKeyInfo 包装成一个一次性 promise
        const keyInfo = await new Promise<AuthKeyInfo | null>((resolve) => {
            fetchKeyInfo(trimmedUsername, {
                onSuccess: (info) => resolve(info),
                // 握手失败/无该接口 → resolve null,触发降级
                onBizError: () => resolve(null),
                onHttpError: () => resolve(null),
            });
        });

        if (keyInfo && typeof keyInfo === 'object' && keyInfo.salt) {
            try {
                const signed = await signCredential(credRaw, keyInfo);
                handleLogin(signed);
            } catch (e) {
                // 签名失败时直接降级送原文
                // eslint-disable-next-line no-console
                console.warn('[Login] signCredential failed, fallback to plain:', e);
                handleLogin({challenge: credRaw, signature: credRaw});
            }
        } else {
            // 降级:老后端不要求握手时,直接用原文登录
            handleLogin({challenge: credRaw, signature: credRaw});
        }
    };

    return (
        /* 背景: content2 为主, 叠加 primary/secondary/success 淡色光晕,
           完全从 HeroUI token 取, 零自定义 hex */
        <div className="relative flex min-h-screen w-full overflow-hidden bg-content2">
            {/* 漂浮装饰圆 (blur + opacity, 只用 HeroUI 色板派生) */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div
                    className="absolute -top-40 -left-32 h-[26rem] w-[26rem] rounded-full bg-primary-100/70 blur-3xl animate-float"/>
                <div
                    className="absolute top-1/3 -right-28 h-[22rem] w-[22rem] rounded-full bg-secondary-100/60 blur-3xl animate-floatSlow"/>
                <div
                    className="absolute -bottom-40 left-1/3 h-[22rem] w-[22rem] rounded-full bg-success-100/50 blur-3xl animate-float"/>
                {/* 网格纹理, content3 再浅一层 */}
                <div
                    className="absolute inset-0 opacity-[0.35]"
                    style={{
                        backgroundImage:
                            'linear-gradient(to right, color-mix(in srgb, var(--heroui-foreground,#111) 4%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--heroui-foreground,#111) 4%, transparent) 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                    }}
                />
            </div>

            {/* 主题切换 (悬浮右上角) */}
            <button
                type="button"
                onClick={toggle}
                aria-label="切换主题"
                className="absolute right-4 top-4 z-20 rounded-medium border border-divider bg-content1/70 p-2 text-foreground/70 backdrop-blur hover:text-foreground sm:right-8 sm:top-6"
            >
                {theme === 'light' ? <MoonIcon className="h-5 w-5"/> : <SunIcon className="h-5 w-5"/>}
            </button>

            {/* 主体 */}
            <div
                className="mx-auto flex w-full max-w-7xl flex-col items-stretch px-4 py-8 md:flex-row md:items-center md:gap-12 md:px-8 md:py-12 lg:px-12">

                {/* 左侧品牌介绍 — 仅 lg+ 显示 */}
                <aside className="hidden flex-1 flex-col gap-8 lg:flex animate-fadeInUp">
                    <div className="flex items-center gap-3">
                        <BrandLogo size={48} className="rounded-xl shadow-md"/>
                        <span className="text-lg font-semibold tracking-wide text-foreground">{APP_TITLE}</span>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-4xl font-semibold leading-tight text-foreground">
                            全栈工业物联网平台
                            <br/>
                            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                连接设备 · 守护稳定
              </span>
                        </h2>
                        <p className="max-w-lg text-base leading-relaxed text-foreground-500">
                            从设备接⼊、点位采集,到规则告警与运维协作,Vex IoT 用一套控制台覆盖工业 SaaS 运维全链路,降低异常定位成本。
                        </p>
                    </div>

                    {/* 特性列表 */}
                    <ul className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-3">
                        {FEATURES.map(({icon: Icon, title, desc}) => (
                            <li
                                key={title}
                                className="rounded-2xl border border-divider bg-content1/60 p-4 backdrop-blur transition hover:border-primary/30 hover:bg-content1"
                            >
                                <div
                                    className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Icon className="h-5 w-5"/>
                                </div>
                                <p className="text-sm font-medium text-foreground">{title}</p>
                                <p className="mt-1 text-xs text-foreground-500">{desc}</p>
                            </li>
                        ))}
                    </ul>

                    {/* 底部 CTA: 管理员登录入口 / 用户登录入口 */}
                    <Divider className="my-2"/>
                    <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-500">
              {isAdminMode ? '已经有普通账号?' : '需要管理员动态码登录?'}
            </span>
                        <Link
                            to={isAdminMode ? '/login' : '/login/admin'}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                            {isAdminMode ? '返回账密登录' : '去管理员登录'}
                            <ArrowTopRightOnSquareIcon className="h-4 w-4"/>
                        </Link>
                    </div>
                </aside>

                {/* 登录卡 (右侧/移动端) */}
                <section className="mx-auto w-full max-w-md flex-1 animate-fadeInUp sm:max-w-lg lg:max-w-xl">
                    <div
                        className="rounded-3xl border border-divider bg-content1/70 p-7 shadow-2xl backdrop-blur-xl sm:p-9 lg:p-11">
                        {/* 移动端顶部 Logo (大屏隐藏) */}
                        <div className="mb-7 flex items-center gap-3 lg:hidden">
                            <BrandLogo size={44} className="rounded-xl shadow-md"/>
                            <div>
                                <p className="text-base font-semibold text-foreground">{APP_TITLE}</p>
                                <p className="text-xs text-foreground-500">
                                    {isAdminMode ? '管理员动态码登录' : '欢迎回到控制台'}
                                </p>
                            </div>
                        </div>

                        {/* 大屏顶部标题 */}
                        <div className="mb-7 hidden flex-col gap-2 lg:flex">
                            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                                {isAdminMode ? '管理员登录' : '欢迎回归 👋'}
                            </h1>
                            <p className="text-sm text-foreground-500">
                                {isAdminMode
                                    ? '使用 TOTP 动态码登录,获得系统最高权限'
                                    : '使用您的账号进入设备监控与运维平台'}
                            </p>
                        </div>

                        <form onSubmit={onSubmit} className="flex flex-col gap-5">
                            <Input
                                size="lg"
                                // label="用户名"
                                labelPlacement="outside"
                                placeholder={isAdminMode ? 'admin' : '请输入用户名'}
                                value={username}
                                onValueChange={setUsername}
                                autoComplete="username"
                                isRequired
                                variant="bordered"
                                classNames={{
                                    inputWrapper: 'bg-content1 hover:bg-content1 data-[focus=true]:bg-content1',
                                }}
                            />
                            {isAdminMode ? (
                                <InputOtp
                                    length={6}
                                    // label={credentialLabel}
                                    // description="6 位数字, 由认证器 / 邮件动态码生成"
                                    value={credential}
                                    onValueChange={setCredential}
                                    isRequired
                                    size="lg"
                                    variant="bordered"
                                    validate={(v: string) =>
                                        v.length === 0
                                            ? '请输入动态码'
                                            : v.length < 6
                                                ? '动态码需 6 位'
                                                : null
                                    }
                                    classNames={{
                                        segmentWrapper: 'gap-2 sm:gap-3',
                                        segment: 'h-12 w-10 bg-content1 text-lg border border-divider data-[active=true]:border-primary data-[has-value=true]:border-primary/60 sm:h-14 sm:w-12 sm:text-xl',
                                    }}
                                />
                            ) : (
                                <Input
                                    size="lg"
                                    // label={credentialLabel}
                                    labelPlacement="outside"
                                    placeholder={credentialPlaceholder}
                                    value={credential}
                                    onValueChange={setCredential}
                                    type={credentialType}
                                    autoComplete="current-password"
                                    isRequired
                                    variant="bordered"
                                    endContent={
                                        <button
                                            type="button"
                                            className="text-foreground/50 transition hover:text-foreground"
                                            onClick={() => setPwdVisible((v) => !v)}
                                            aria-label="切换密码可见"
                                        >
                                            {pwdVisible
                                                ? <EyeSlashIcon className="h-5 w-5"/>
                                                : <EyeIcon className="h-5 w-5"/>}
                                        </button>
                                    }
                                    classNames={{
                                        inputWrapper: 'bg-content1 hover:bg-content1 data-[focus=true]:bg-content1',
                                    }}
                                />
                            )}

                            {/* 操作提示 */}
                            <div className="flex items-center justify-between text-xs text-foreground-500">
                <span className="flex items-center gap-1">
                  <ShieldCheckIcon className="h-3.5 w-3.5 text-primary"/>
                  传输数据全程 TLS 加密
                </span>
                            </div>

                            <Button
                                type="submit"
                                color="primary"
                                size="md"
                                // variant="bordered"
                                isLoading={loading}
                                className="h-12 border-2 font-medium text-base sm:h-14"
                                fullWidth
                            >
                                登&nbsp;&nbsp;录
                            </Button>
                        </form>

                        {/* 移动端切换登录方式 */}
                        <div className="mt-6 flex justify-center border-t border-divider pt-5 text-xs lg:hidden">
                            {isAdminMode ? (
                                <Link to="/login" className="text-primary">账密登录</Link>
                            ) : (
                                <Link to="/login/admin" className="text-foreground-500 hover:text-foreground">
                                    管理员动态码登录
                                </Link>
                            )}
                        </div>

                        <p className="mt-5 text-center text-[11px] text-foreground-400">
                            v0.1.0 · Vex IoT © {new Date().getFullYear()} ·{' '}
                            <a
                                href={OFFICIAL_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary hover:underline"
                            >
                                {OFFICIAL_SITE}
                            </a>
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
