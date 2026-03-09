import { create } from 'zustand';

export type ModalType = 'none' | 'newProject' | 'openProject' | 'saveProject' | 'exportWires' | 'about';

interface UIStore {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  activeModal: ModalType;
  bfieldPanelOpen: boolean;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setActiveModal: (m: ModalType) => void;
  closeModal: () => void;
  toggleBFieldPanel: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  activeModal: 'none',
  bfieldPanelOpen: false,
  toggleLeftSidebar: () => set(s => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleRightSidebar: () => set(s => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  setActiveModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: 'none' }),
  toggleBFieldPanel: () => set(s => ({ bfieldPanelOpen: !s.bfieldPanelOpen })),
}));
