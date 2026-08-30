package com.vex.iot.common.queries;

import java.io.Serial;
import java.io.Serializable;

/**
 * 分页参数:page 从 0 起始。
 *
 * @author vex
 */
public class QueriesPage implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    private int page;
    private int size;

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }
}