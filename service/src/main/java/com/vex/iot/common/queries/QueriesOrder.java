package com.vex.iot.common.queries;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.vex.iot.common.config.IEnum;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 排序条件
 */
@Data
public class QueriesOrder implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 排序字段名(对齐前端 field 命名,fieldName 作为旧别名保留)
     */
    @JsonAlias("fieldName")
    private String field;

    /**
     * 排序方向
     */
    private QueriesOrderEnum order;
    /**
     * 排序方向枚举
     */
    public enum QueriesOrderEnum implements IEnum {
        /**
         * 升序
         */
        ASC,
        /**
         * 降序
         */
        DESC;

        
        @Override
        public String displayName() {
            return name();
        }
    }
}
