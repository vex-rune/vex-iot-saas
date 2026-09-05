package com.vex.iot.domain.schedule.repository;

import com.vex.iot.domain.schedule.model.PendingFire;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 待触发队列 — 内存实现。
 * <p>基于 {@link CopyOnWriteArrayList}，适用于单实例部署。
 * <p>多实例场景替换为 Redis 实现即可，无需改动上层逻辑。
 */
@Repository
public class InMemoryPendingFireRepository implements PendingFireRepository {

    private final CopyOnWriteArrayList<PendingFire> store = new CopyOnWriteArrayList<>();

    @Override
    public List<PendingFire> findAll() {
        return new ArrayList<>(store);
    }

    @Override
    public void replaceAll(List<PendingFire> fires) {
        store.clear();
        store.addAll(fires);
    }

    @Override
    public void remove(List<PendingFire> fires) {
        store.removeAll(fires);
    }

    @Override
    public boolean isEmpty() {
        return store.isEmpty();
    }

    @Override
    public int size() {
        return store.size();
    }
}