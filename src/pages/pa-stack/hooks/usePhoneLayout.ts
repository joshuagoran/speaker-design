import { useState } from "react";
import type { Setter } from "../../../types";

/** The result sections that fold on phones. */
export type FoldId = "sub" | "mid" | "horn" | "totals";
/** The tabs of the phone settings sheet. */
export type SettingsTab = "sub" | "mid" | "horn" | "look";

export interface PhoneLayout {
  isSettingsSheetOpen: boolean;
  setSettingsSheetOpen: Setter<boolean>;
  activeTab: SettingsTab;
  setActiveTab: Setter<SettingsTab>;
  tabClass: (t: SettingsTab) => string;
  expandedSections: Record<FoldId, boolean>;
  setExpandedSections: Setter<Record<FoldId, boolean>>;
  toggleSection: (id: FoldId) => void;
}

/** Phone layout: the bottom settings sheet with its tabs, and which result sections are folded open (remembered per viewer). */
export function usePhoneLayout(): PhoneLayout {
  /** phones: settings live in a bottom sheet with tabs; result sections fold (remembered per viewer) */
  const [isSettingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("sub");
  const tabClass = (t: SettingsTab) => (activeTab === t ? "" : "max-md:hidden");
  const [expandedSections, setExpandedSections] = useState<Record<FoldId, boolean>>(() => {
    try {
      return {
        sub: true,
        mid: false,
        horn: false,
        totals: false,
        ...JSON.parse(localStorage.getItem("planner.folds") || "{}"),
      };
    } catch {
      return { sub: true, mid: false, horn: false, totals: false };
    }
  });
  const toggleSection = (id: FoldId) =>
    setExpandedSections((f) => {
      const n = { ...f, [id]: !f[id] };
      try {
        localStorage.setItem("planner.folds", JSON.stringify(n));
      } catch {}
      return n;
    });
  return {
    isSettingsSheetOpen,
    setSettingsSheetOpen,
    activeTab,
    setActiveTab,
    tabClass,
    expandedSections,
    setExpandedSections,
    toggleSection,
  };
}
