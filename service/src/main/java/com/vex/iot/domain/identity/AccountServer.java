package com.vex.iot.domain.identity;

import com.vex.iot.common.constants.RoleConstants;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.domain.auth.util.PasswordHasher;
import com.vex.iot.domain.identity.exception.InvalidCredentialException;
import com.vex.iot.domain.identity.model.AccountEntity;
import com.vex.iot.domain.identity.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 用户服务
 *
 * <p>封装用户相关的业务逻辑，包括用户查找、密码验证等。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountServer {

    /**
     * 系统用户仓储
     */
    private final AccountRepository userRepository;

    /**
     * 根据用户名加载用户
     *
     * @param username 用户名
     * @return 系统用户
     * @throws UsernameNotFoundException 用户不存在
     */
    public AccountEntity loadByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在"));
    }

    /**
     * 判断用户是否为管理员
     *
     * @param user 系统用户
     * @return 是否为管理员
     */
    public boolean isAdmin(AccountEntity user) {
        if (user.getRoles() == null) {
            return false;
        }
        return user.getRoles().contains(RoleConstants.SUPER_ADMIN);
    }

    /**
     * 验证账号密码
     *
     * @param user     系统用户
     * @param password 明文密码
     */
    public void verifyPassword(AccountEntity user, String password) {
        if (!PasswordHasher.verify(user.getSalt(), password, user.getPasswordHash())) {
            throw new InvalidCredentialException("密码错误");
        }
    }

    /**
     * 更新最后登录时间
     *
     * @param username 用户名
     */
    public void updateLastLogin(String username) {
        userRepository.findByUsername(username).ifPresent(user -> {
            LocalDateTime now = LocalDateTime.now();
            user.setLastLoginAt(now);
            user.stampUpdated(BaseEntity.SYSTEM_USER_ID, now);
            userRepository.save(user);
        });
    }

    /**
     * 修改密码
     *
     * @param username   用户名
     * @param newPlain 新密码
     */
    public void changePassword(String username, String newPlain) {
        AccountEntity user = loadByUsername(username);
        String newSalt = PasswordHasher.generateSalt();
        user.setSalt(newSalt);
        user.setPasswordHash(PasswordHasher.hash(newSalt, newPlain));
        LocalDateTime now = LocalDateTime.now();
        user.stampUpdated(BaseEntity.SYSTEM_USER_ID, now);
        userRepository.save(user);
        log.info("用户密码已重置 username={}", username);
    }
}
