const { useState } = React;

/** Phone layout: the bottom settings sheet with its tabs, and which result sections are folded open (remembered per viewer). */
export function usePhoneLayout() {
  // phones: settings live in a bottom sheet with tabs; result sections fold (remembered per viewer)
  const [isSettingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("sub");
  const tabClass = (t) => (activeTab === t ? "" : "max-md:hidden");
  const [expandedSections, setExpandedSections] = useState(() => {
    try { return { sub: true, mid: false, horn: false, totals: false, ...JSON.parse(localStorage.getItem("planner.folds") || "{}") }; }
    catch { return { sub: true, mid: false, horn: false, totals: false }; }
  });
  const toggleSection = (id) => setExpandedSections((f) => { const n = { ...f, [id]: !f[id] }; try { localStorage.setItem("planner.folds", JSON.stringify(n)); } catch {} return n; });
  const sectionClass = (id) => (expandedSections[id] ? "" : "max-md:hidden");
  return {
    isSettingsSheetOpen,
    setSettingsSheetOpen,
    activeTab,
    setActiveTab,
    tabClass,
    expandedSections,
    setExpandedSections,
    toggleSection,
    sectionClass,
  };
}
