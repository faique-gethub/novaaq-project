import React from "react";
import Svg, { Polygon } from "react-native-svg";
import { colors } from "@/src/theme";

type Props = {
  size?: number;
  outerColor?: string;
  innerColor?: string;
  bgColor?: string;
};

// Two nested equilateral triangles — outer filled, inner cut with bg color.
export const TriangleLogo: React.FC<Props> = ({
  size = 96,
  outerColor = colors.primary,
  innerColor = colors.white,
  bgColor = "transparent",
}) => {
  const pad = size * 0.08;
  const outerPts = [
    [size / 2, pad],
    [pad, size - pad],
    [size - pad, size - pad],
  ];
  const inset = size * 0.28;
  const innerPts = [
    [size / 2, pad + inset * 0.65],
    [pad + inset, size - pad - inset * 0.35],
    [size - pad - inset, size - pad - inset * 0.35],
  ];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {bgColor !== "transparent" && (
        <Polygon points={`0,0 ${size},0 ${size},${size} 0,${size}`} fill={bgColor} />
      )}
      <Polygon
        points={outerPts.map((p) => p.join(",")).join(" ")}
        fill={outerColor}
      />
      <Polygon
        points={innerPts.map((p) => p.join(",")).join(" ")}
        fill={innerColor}
      />
    </Svg>
  );
};
