package com.vex.iot.common.response;

import java.io.Serializable;

public record Response<T>(String code, String message, T data) implements Serializable {

    public static <T> Response<T> ok() {
        return new Response<>("ok", "成功", null);
    }

    public static <T> Response<T> ok(T data) {
        return new Response<>("ok", "成功", data);
    }

    public static <T> Response<T> fail(String code, String message) {
        return new Response<>(code, message, null);
    }
}
