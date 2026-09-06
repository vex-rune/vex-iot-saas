import {create} from 'zustand';
import {storage} from '@/lib/storage';

type Theme = 'light' | 'dark';

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggle: () => void;
}

const initial = (storage.getString('theme') as Theme | null) ?? 'light';

function applyTheme(theme: Theme) {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
}

applyTheme(initial);

export const useThemeStore = create<ThemeState>((set, get) => ({
    theme: initial,
    setTheme: (theme) => {
        storage.setString('theme', theme);
        applyTheme(theme);
        set({theme});
    },
    toggle: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        storage.setString('theme', next);
        applyTheme(next);
        set({theme: next});
    },
}));
