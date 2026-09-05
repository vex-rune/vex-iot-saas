package com.vex.iot.domain.schedule.repository;

import com.vex.iot.domain.schedule.model.PendingFire;

import java.util.List;

/**
 * 待触发队列仓储接口。
 * <p>预热写入、扫描消费。当前提供内存实现，未来可替换为 Redis 等分布式实现。
 */
public interface PendingFireRepository {

    /**
     * 获取当前所有待触发条目（按 fireTime 升序）。
     */
    List<PendingFire> findAll();

    /**
     * 原子替换全部待触发条目（预热时调用）。
     */
    void replaceAll(List<PendingFire> fires);

    /**
     * 移除指定条目（扫描触发后调用）。
     */
    void remove(List<PendingFire> fires);

    /**
     * 是否为空。
     */
    boolean isEmpty();

    /**
     * 当前待办数量。
     */
    int size();
}