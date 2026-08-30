package com.vex.iot.common.exception;

/**
 * 业务异常基类:抽象类,业务侧必须继承并实现具体异常类型(如 DeviceNotFoundException),
 * 禁止直接 new BizException(...)。
 *
 * <p>设计动机:
 * <ul>
 *   <li>统一 code/message/cause 三要素语义,所有具体业务异常都拥有相同契约;</li>
 *   <li>强制业务方为每一种异常"命名",而不是随手 new 一个带 resultCode 的异常;</li>
 *   <li>GlobalExceptionHandler 仅捕获 BizException 根类型,所有子类自动命中。</li>
 * </ul>
 *
 * <p>每个子类需定义 CODE 常量，使用简短说明性短语。
 */
public abstract class BizException extends RuntimeException {

    private final String code;

    protected BizException(String code) {
        super();
        this.code = code;
    }

    protected BizException(String code, String msg) {
        super(msg);
        this.code = code;
    }

    protected BizException(String code, String msg, Throwable cause) {
        super(msg, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
