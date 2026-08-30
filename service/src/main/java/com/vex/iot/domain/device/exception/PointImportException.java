package com.vex.iot.domain.device.exception;

/// 点表导入失败异常
public class PointImportException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "point_import_failed";

    public PointImportException(String msg) {
        super(CODE, msg);
    }
}
