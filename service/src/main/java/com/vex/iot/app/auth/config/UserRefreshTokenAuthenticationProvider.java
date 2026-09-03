package com.vex.iot.app.auth.config;

import com.vex.iot.app.auth.model.LoginUser;
import com.vex.iot.app.auth.util.JwtHandler;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.domain.identity.AccountService;
import com.vex.iot.domain.identity.TenantService;
import com.vex.iot.domain.identity.exception.InvalidCredentialException;
import com.vex.iot.domain.identity.model.AccountEntity;
import com.vex.iot.domain.identity.model.SysTenantAccountEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 用户刷新 token 认证提供者。
 *
 * <p>校验链与 {@link UserAuthenticationProvider} 一致,只是凭证类型换成 refresh token,
 * 并额外支持"切换目标租户"语义:
 * <ol>
 *   <li>refresh token 合法(签名 + 未过期)— 由 {@link JwtHandler#parse} 完成;</li>
 *   <li>refresh token 对应的账号仍存在且 {@link AccountEntity#isEnabled()};</li>
 *   <li>账号在至少一个租户下有"启用且未软删"的授权行;</li>
 *   <li>如果 {@code targetTenantId} 非空:
 *       <ul>
 *         <li>账号必须在目标租户下有可用授权行({@link AccountService#hasUsableLinkInTenant});</li>
 *         <li>目标租户本身必须可用({@link TenantService#isTenantUsable});</li>
 *       </ul>
 *   </li>
 *   <li>把 {@code LoginUser.tenantId} 改为目标租户后返回。</li>
 * </ol>
 *
 * <p>异常消息统一收敛,不暴露细粒度原因(避免用户名枚举)。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserRefreshTokenAuthenticationProvider implements AuthenticationProvider {

    private final JwtHandler jwtHandler;
    private final AccountService userServer;
    private final TenantService tenantService;

    @Override
    public boolean supports(Class<?> authentication) {
        return UserRefreshTokenAuthenticationToken.class.isAssignableFrom(authentication);
    }

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        UserRefreshTokenAuthenticationToken token = (UserRefreshTokenAuthenticationToken) authentication;
        String refreshToken = token.getRefreshToken();
        String targetTenantId = token.getTargetTenantId();

        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BadCredentialsException("刷新令牌不能为空");
        }

        // 1) 解析 refresh token,拿到原 LoginUser.username
        LoginUser parsed;
        try {
            parsed = jwtHandler.parse(refreshToken, JwtHandler.TokenType.REFRESH);
        } catch (Exception ex) {
            log.debug("refresh token 解析失败: {}", ex.getMessage());
            throw new InvalidCredentialException("账号或凭证不正确");
        }

        // 2) 账号仍存在 + 启用
        AccountEntity user;
        try {
            user = userServer.loadByUsername(parsed.username());
        } catch (org.springframework.security.core.userdetails.UsernameNotFoundException ex) {
            throw new InvalidCredentialException("账号或凭证不正确");
        }
        if (!user.isEnabled()) {
            throw new InvalidCredentialException("账号或凭证不正确");
        }

        // 3) 至少有一条活授权行
        if (!userServer.hasUsableLink(user.getId())) {
            throw new InvalidCredentialException("账号或凭证不正确");
        }

        // 4) 决定最终的 tenantId
        String finalTenantId;
        if (targetTenantId != null && !targetTenantId.isBlank()) {
            // 切换租户:校验目标租户下确实有可用授权
            if (!userServer.hasUsableLinkInTenant(user.getId(), targetTenantId)) {
                throw new InvalidCredentialException("账号或凭证不正确");
            }
            if (!TenantBaseEntity.DEFAULT_TENANT_ID.equals(targetTenantId)
                    && !tenantService.isTenantUsable(targetTenantId)) {
                throw new InvalidCredentialException("账号或凭证不正确");
            }
            finalTenantId = targetTenantId;
        } else {
            // 续命场景:维持 refresh token 里的 tenantId
            String originalTenantId = parsed.tenantId();
            if (originalTenantId != null && !originalTenantId.isBlank()) {
                // 顺手校验一下:原租户仍然可用
                if (!TenantBaseEntity.DEFAULT_TENANT_ID.equals(originalTenantId)
                        && !tenantService.isTenantUsable(originalTenantId)) {
                    throw new InvalidCredentialException("账号或凭证不正确");
                }
                finalTenantId = originalTenantId;
            } else {
                // refresh token 里没带 tenantId,挑一个可用租户
                List<SysTenantAccountEntity> links = userServer.listAvailableLinksOfUser(user.getId());
                finalTenantId = links.stream()
                        .map(SysTenantAccountEntity::getTenantId)
                        .filter(tid -> TenantBaseEntity.DEFAULT_TENANT_ID.equals(tid)
                                || tenantService.isTenantUsable(tid))
                        .findFirst()
                        .orElseThrow(() -> new InvalidCredentialException("账号或凭证不正确"));
            }
        }

        // 5) 构造新的 LoginUser + authorities,返回认证成功的 token
        LoginUser newLoginUser = LoginUser.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .tenantId(finalTenantId)
                .roles(user.getRoles() == null ? Set.of() : user.getRoles())
                .build();
        Set<SimpleGrantedAuthority> authorities = newLoginUser.roles().stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toSet());

        log.debug("用户 {} 通过 refresh token 换发 token,tenantId={} (targetTenantId={})",
                user.getUsername(), finalTenantId, targetTenantId);

        return new UserRefreshTokenAuthenticationToken(newLoginUser, authorities);
    }
}