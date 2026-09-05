package com.vex.iot.common.queries;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.vex.iot.common.config.IEnum;

import java.io.Serial;
import java.io.Serializable;

/**
 * 排序条件
 */
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
     * 获取排序字段名
     *
     * @return 排序字段名
     */
    public String getField() {
        return field;
    }

    /**
     * 设置排序字段名
     *
     * @param field 排序字段名
     */
    public void setField(String field) {
        this.field = field;
    }

    /**
     * 获取排序方向
     *
     * @return 排序方向
     */
    public QueriesOrderEnum getOrder() {
        return order;
    }

    /**
     * 设置排序方向
     *
     * @param order 排序方向
     */
    public void setOrder(QueriesOrderEnum order) {
        this.order = order;
    }

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
