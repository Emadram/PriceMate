import create from 'zustand';

const useNavHistoryStore = create((set, get) => ({
  stack: [],
  push: (path) => set((s) => {
    if (!path) return s;
    const last = s.stack[s.stack.length - 1];
    if (last === path) return s;
    return { stack: [...s.stack, path] };
  }),
  pop: () => {
    const s = get();
    if (!s.stack || s.stack.length === 0) return null;
    const stack = [...s.stack];
    const last = stack.pop();
    set({ stack });
    return last;
  },
  peek: () => {
    const s = get();
    const stack = s.stack || [];
    return stack.length === 0 ? null : stack[stack.length - 1];
  },
  clear: () => set({ stack: [] }),
}));

export default useNavHistoryStore;
