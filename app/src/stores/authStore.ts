import {create} from 'zustand';
import {storage} from '@/lib/storage';

export interface CurrentUser {
    userId: string;
    username: string;
    nickname?: string;
    roles: string[];
    tenantId?: string;
}

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: CurrentUser | null;
    setTokens: (access: string, refresh: string) => void;
    setUser: (user: CurrentUser) => void;
    setTenantId: (tenantId: string) => void;
    clear: () => void;
    /**
     * 从 JWT payload 解析当前用户(无签名校验,仅用于展示)。
     * 用于登录后 /me 失败时 fallback,以及应用启动时 bootstrapping。
     */
    parseUserFromToken: (token: string) => CurrentUser | null;
}

/**
 * 从 JWT payload 解析当前用户(无签名校验,仅用于展示)。
 *
 * <p>JWT 形如 header.payload.signature,payload 是 base64url 编码的 JSON。
 * 后端 JwtHandler.generate 把以下字段写入 payload:
 *   sub (userId), username, tenantId, roles[]</p>
 */
function parseUserFromJwt(token: string): CurrentUser | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const claims = JSON.parse(payloadJson) as {
            sub?: string;
            username?: string;
            tenantId?: string;
            roles?: string[];
        };
        if (!claims.username) return null;
        return {
            userId: claims.sub ?? '',
            username: claims.username,
            roles: Array.isArray(claims.roles) ? claims.roles : [],
            tenantId: claims.tenantId || undefined,
        };
    } catch {
        return null;
    }
}

const initialAccess = storage.getString('accessToken');
const initialRefresh = storage.getString('refreshToken');
const initialUser = storage.get<CurrentUser>('user');

/**
 * 应用启动时,如果 localStorage 里有 accessToken 但 user 为空,
 * 从 token payload 解析一份基础 user(避免页面头部显示"未登录")。
 */
function bootstrapUser(token: string | null, stored: CurrentUser | null): CurrentUser | null {
    if (stored) return stored;
    if (!token) return null;
    return parseUserFromJwt(token);
}

export const useAuthStore = create<AuthState>((set, get) => ({
    accessToken: initialAccess,
    refreshToken: initialRefresh,
    user: bootstrapUser(initialAccess, initialUser),
    setTokens: (access, refresh) => {
        storage.setString('accessToken', access);
        storage.setString('refreshToken', refresh);
        set({accessToken: access, refreshToken: refresh});
    },
    setUser: (user) => {
        storage.set('user', user);
        set({user});
    },
    setTenantId: (tenantId: string) => {
        const cur = get().user;
        if (!cur) return;
        const next = {...cur, tenantId};
        storage.set('user', next);
        set({user: next});
    },
    clear: () => {
        storage.remove('accessToken');
        storage.remove('refreshToken');
        storage.remove('user');
        set({accessToken: null, refreshToken: null, user: null});
    },
    parseUserFromToken: (token: string) => parseUserFromJwt(token),
}));
