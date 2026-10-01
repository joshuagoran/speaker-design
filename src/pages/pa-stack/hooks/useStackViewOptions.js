const { useEffect, useState } = React;

/** View toggles on the PA stack page: dispersion plane, details panel and full-screen 3D. */
export function useStackViewOptions() {
  const [dispersionPlane, setDispersionPlane] = useState("v");    // dispersion map: vertical (lobing) or horizontal
  const [showDetails, setShowDetails] = useState(false);
  const [isFull3d, setIsFull3d] = useState(false);
  useEffect(() => {
    if (!isFull3d) return;
    const esc = (e) => { if (e.key === "Escape") setIsFull3d(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [isFull3d]);
  return {
    dispersionPlane,
    setDispersionPlane,
    showDetails,
    setShowDetails,
    isFull3d,
    setIsFull3d,
  };
}
