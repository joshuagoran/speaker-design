const { useState } = React;

/** Cutlist choices: corner joint, plywood sheet size and how many sets of boxes to cut. */
export function useCutlistOptions() {
  const [cornerJoint, setCornerJoint] = useState("butt");       // cutlist corner joints
  const [plywoodSheetKind, setPlywoodSheetKind] = useState("4x8");
  const [boxSetCount, setBoxSetCount] = useState(2);   // how many sets of boxes the cutlist covers
  return {
    cornerJoint,
    setCornerJoint,
    plywoodSheetKind,
    setPlywoodSheetKind,
    boxSetCount,
    setBoxSetCount,
  };
}
