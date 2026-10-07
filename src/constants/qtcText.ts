/** The net volume, L, at which a sealed box reaches Qtc 0.5, as the PA mid's and the Hi-fi woofer's Qtc chips word it. */
export const qtcFloorAt = (netL: number) => `Qtc 0.5 at ${netL.toFixed(netL < 10 ? 1 : 0)} L net.`;
