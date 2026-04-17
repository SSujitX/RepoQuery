import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProjectUiState {
  currentProjectId: string | null;
  currentChatId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  setCurrentChatId: (id: string | null) => void;
}

export const useProjectStore = create<ProjectUiState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      currentChatId: null,
      setCurrentProjectId: (id) => set({ currentProjectId: id }),
      setCurrentChatId: (id) => set({ currentChatId: id }),
    }),
    {
      name: "repoquery-ui-state",
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        currentChatId: state.currentChatId,
      }),
    }
  )
);
