import { create } from 'zustand';
import { storage } from '@/lib/storage';

/** 视图模式:跟随窗口(auto) / 强制手机(mobile) / 强制电脑(desktop) */
export type ViewMode = 'auto' | 'mobile' | 'desktop';

interface ViewModeState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggle: () => void;
}

const initial = (storage.getString('viewMode') as ViewMode | null) ?? 'auto';

export const useViewModeStore = create<ViewModeState>((set, get) => ({
  viewMode: initial,
  setViewMode: (mode) => {
    storage.setString('viewMode', mode);
    set({ viewMode: mode });
  },
  /** 在手机/电脑之间快速切换(auto 不参与) */
  toggle: () => {
    const next: ViewMode = get().viewMode === 'mobile' ? 'desktop' : 'mobile';
    storage.setString('viewMode', next);
    set({ viewMode: next });
  },
}));
