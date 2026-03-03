export type V2RatioMode = "centerline-2x" | "outer-2x";

export interface CircleSpec {
  cx: number;
  cy: number;
  r: number;
}

export interface LGeometry {
  xL: number;
  yTop: number;
  yBottom: number;
  xFootEnd: number;
}

export interface SolvedV2Geometry {
  geometry: LGeometry;
  solver: "closed-form" | "numeric";
  notes: string[];
}

const EPSILON = 1e-6;

interface Point {
  x: number;
  y: number;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const distanceToCenter = (circle: CircleSpec, point: Point): number =>
  Math.hypot(point.x - circle.cx, point.y - circle.cy);

const ratioHeightFromWidth = (
  width: number,
  ratioMode: V2RatioMode,
  strokeWidth: number,
): number => (ratioMode === "centerline-2x" ? 2 * width : 2 * width + strokeWidth);

const topPoint = (geometry: LGeometry): Point => ({ x: geometry.xL, y: geometry.yTop });

const cornerPoint = (geometry: LGeometry): Point => ({ x: geometry.xL, y: geometry.yBottom });

const endpointPoint = (geometry: LGeometry): Point => ({
  x: geometry.xFootEnd,
  y: geometry.yBottom,
});

const geometryFromABCentered = (input: {
  circle: CircleSpec;
  a: number;
  b: number;
}): LGeometry => ({
  xL: input.circle.cx - input.a,
  xFootEnd: input.circle.cx + input.a,
  yTop: input.circle.cy - input.b,
  yBottom: input.circle.cy + input.b,
});

const geometryFromABWithRelaxedTop = (input: {
  circle: CircleSpec;
  a: number;
  b: number;
  ratioMode: V2RatioMode;
  strokeWidth: number;
}): LGeometry => {
  const width = 2 * input.a;
  const height = ratioHeightFromWidth(width, input.ratioMode, input.strokeWidth);
  const yBottom = input.circle.cy + input.b;
  return {
    xL: input.circle.cx - input.a,
    xFootEnd: input.circle.cx + input.a,
    yTop: yBottom - height,
    yBottom,
  };
};

const bisection = (input: {
  fn: (value: number) => number;
  lo: number;
  hi: number;
  maxIterations?: number;
  tolerance?: number;
}): number => {
  let lo = input.lo;
  let hi = input.hi;
  const maxIterations = input.maxIterations ?? 96;
  const tolerance = input.tolerance ?? 1e-10;
  let fLo = input.fn(lo);
  let fHi = input.fn(hi);

  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) {
    throw new Error("Bisection endpoints are not finite.");
  }

  if (Math.abs(fLo) <= tolerance) {
    return lo;
  }

  if (Math.abs(fHi) <= tolerance) {
    return hi;
  }

  if (fLo * fHi > 0) {
    throw new Error("Bisection interval does not bracket a root.");
  }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const mid = (lo + hi) / 2;
    const fMid = input.fn(mid);
    if (!Number.isFinite(fMid)) {
      throw new Error("Bisection midpoint produced non-finite value.");
    }

    if (Math.abs(fMid) <= tolerance) {
      return mid;
    }

    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  return (lo + hi) / 2;
};

const findRootBrackets = (input: {
  fn: (value: number) => number;
  start: number;
  end: number;
  segments: number;
}): Array<{ lo: number; hi: number }> => {
  const brackets: Array<{ lo: number; hi: number }> = [];
  const step = (input.end - input.start) / input.segments;

  let previousX = input.start;
  let previousY = input.fn(previousX);

  for (let index = 1; index <= input.segments; index += 1) {
    const currentX = index === input.segments ? input.end : input.start + step * index;
    const currentY = input.fn(currentX);
    if (!Number.isFinite(previousY) || !Number.isFinite(currentY)) {
      previousX = currentX;
      previousY = currentY;
      continue;
    }

    if (Math.abs(previousY) <= EPSILON) {
      brackets.push({ lo: previousX, hi: previousX });
    } else if (previousY * currentY < 0 || Math.abs(currentY) <= EPSILON) {
      brackets.push({ lo: previousX, hi: currentX });
    }

    previousX = currentX;
    previousY = currentY;
  }

  return brackets;
};

const resolveOuterA = (radiusTarget: number, strokeWidth: number): number => {
  const discriminant = 20 * radiusTarget * radiusTarget - strokeWidth * strokeWidth;
  if (discriminant <= 0) {
    throw new Error(`Invalid outer-ratio discriminant for radius=${radiusTarget}.`);
  }

  return (-2 * strokeWidth + Math.sqrt(discriminant)) / 10;
};

export const solveCenteredThreeTouch = (input: {
  circle: CircleSpec;
  radiusTarget: number;
  ratioMode: V2RatioMode;
  strokeWidth: number;
}): SolvedV2Geometry => {
  const { circle, radiusTarget, ratioMode, strokeWidth } = input;
  const a =
    ratioMode === "centerline-2x"
      ? radiusTarget / Math.sqrt(5)
      : resolveOuterA(radiusTarget, strokeWidth);
  const b = ratioMode === "centerline-2x" ? 2 * a : 2 * a + strokeWidth / 2;

  return {
    geometry: geometryFromABCentered({ circle, a, b }),
    solver: "closed-form",
    notes: ["top/corner/endpoint are all tangent to target radius"],
  };
};

const solveBottomLeftTwoTouchPointSearch = (input: {
  circle: CircleSpec;
  radiusTarget: number;
  ratioMode: V2RatioMode;
  strokeWidth: number;
}): SolvedV2Geometry => {
  const { circle, radiusTarget, ratioMode, strokeWidth } = input;
  const outerOffset = ratioMode === "outer-2x" ? strokeWidth : 0;
  const thetaStart = toRadians(92);
  const thetaEnd = toRadians(170);
  const thetaStep = toRadians(0.1);
  const phiStart = toRadians(-89.9);
  const phiEnd = toRadians(35);

  let best: { geometry: LGeometry; score: number } | null = null;

  const pointOnRadius = (theta: number): Point => ({
    x: circle.cx + radiusTarget * Math.cos(theta),
    y: circle.cy - radiusTarget * Math.sin(theta),
  });

  for (let theta = thetaStart; theta <= thetaEnd + EPSILON; theta += thetaStep) {
    const top = pointOnRadius(theta);
    const equation = (phi: number): number => {
      const endpoint = pointOnRadius(phi);
      const deltaX = endpoint.x - top.x;
      const deltaY = endpoint.y - top.y;
      return deltaY - 2 * deltaX - outerOffset;
    };

    const brackets = findRootBrackets({
      fn: equation,
      start: phiStart,
      end: phiEnd,
      segments: 1024,
    });

    for (const bracket of brackets) {
      const phi =
        Math.abs(bracket.hi - bracket.lo) <= EPSILON
          ? bracket.lo
          : bisection({
              fn: equation,
              lo: bracket.lo,
              hi: bracket.hi,
              tolerance: 1e-9,
            });

      const endpoint = pointOnRadius(phi);
      if (endpoint.x <= top.x || endpoint.y <= top.y) {
        continue;
      }

      const geometry: LGeometry = {
        xL: top.x,
        yTop: top.y,
        xFootEnd: endpoint.x,
        yBottom: endpoint.y,
      };

      const corner = cornerPoint(geometry);
      if (distanceToCenter(circle, corner) > radiusTarget + 1e-4) {
        continue;
      }

      const score = circle.cx - geometry.xL + (geometry.yBottom - circle.cy);
      if (!best || score > best.score) {
        best = { geometry, score };
      }
    }
  }

  if (!best) {
    throw new Error(
      `No bottom-left two-touch solution found for radius=${radiusTarget}, ratio=${ratioMode}.`,
    );
  }

  return {
    geometry: best.geometry,
    solver: "numeric",
    notes: ["top and endpoint tangent; corner constrained inside target radius"],
  };
};

const solveBottomLeftThreeTouchRelaxed = (input: {
  circle: CircleSpec;
  radiusTarget: number;
  ratioMode: V2RatioMode;
  strokeWidth: number;
  topClearance: number;
}): SolvedV2Geometry => {
  const strict = solveCenteredThreeTouch({
    circle: input.circle,
    radiusTarget: input.radiusTarget,
    ratioMode: input.ratioMode,
    strokeWidth: input.strokeWidth,
  });
  const strictA = (strict.geometry.xFootEnd - strict.geometry.xL) / 2;
  const targetTopDistance = input.radiusTarget - input.topClearance;
  const evaluateTopDistance = (a: number): number => {
    const b = Math.sqrt(Math.max(0, input.radiusTarget * input.radiusTarget - a * a));
    const geometry = geometryFromABWithRelaxedTop({
      circle: input.circle,
      a,
      b,
      ratioMode: input.ratioMode,
      strokeWidth: input.strokeWidth,
    });
    return distanceToCenter(input.circle, topPoint(geometry));
  };

  const fn = (a: number): number => evaluateTopDistance(a) - targetTopDistance;
  const searchMin = strictA * 0.8;
  const searchMax = strictA * 0.999;
  const brackets = findRootBrackets({
    fn,
    start: searchMin,
    end: searchMax,
    segments: 512,
  });
  if (brackets.length === 0) {
    throw new Error(`Unable to bracket relaxed three-touch root for ratio=${input.ratioMode}.`);
  }

  const bracket = brackets[brackets.length - 1];
  const a =
    Math.abs(bracket.hi - bracket.lo) <= EPSILON
      ? bracket.lo
      : bisection({
          fn,
          lo: bracket.lo,
          hi: bracket.hi,
          tolerance: 1e-9,
        });
  const b = Math.sqrt(Math.max(0, input.radiusTarget * input.radiusTarget - a * a));
  const geometry = geometryFromABWithRelaxedTop({
    circle: input.circle,
    a,
    b,
    ratioMode: input.ratioMode,
    strokeWidth: input.strokeWidth,
  });

  return {
    geometry,
    solver: "numeric",
    notes: [
      "corner and endpoint tangent; top intentionally relaxed inside radius",
      `top clearance target=${input.topClearance.toFixed(2)}`,
    ],
  };
};

export const solveV2Geometry = (input: {
  family: "two-touch" | "inset" | "three-touch";
  placement: "centered" | "bottom-left";
  ratioMode: V2RatioMode;
  circle: CircleSpec;
  usableRadius: number;
  insetRadius: number;
  strokeWidth: number;
  relaxedTopClearance: number;
}): SolvedV2Geometry => {
  const radiusTarget = input.family === "inset" ? input.insetRadius : input.usableRadius;

  if (input.family === "three-touch" && input.placement === "bottom-left") {
    return solveBottomLeftThreeTouchRelaxed({
      circle: input.circle,
      radiusTarget,
      ratioMode: input.ratioMode,
      strokeWidth: input.strokeWidth,
      topClearance: input.relaxedTopClearance,
    });
  }

  if (input.placement === "bottom-left") {
    return solveBottomLeftTwoTouchPointSearch({
      circle: input.circle,
      radiusTarget,
      ratioMode: input.ratioMode,
      strokeWidth: input.strokeWidth,
    });
  }

  return solveCenteredThreeTouch({
    circle: input.circle,
    radiusTarget,
    ratioMode: input.ratioMode,
    strokeWidth: input.strokeWidth,
  });
};

export const geometryPoints = (
  geometry: LGeometry,
): { top: Point; corner: Point; endpoint: Point } => ({
  top: topPoint(geometry),
  corner: cornerPoint(geometry),
  endpoint: endpointPoint(geometry),
});

export const geometryWidth = (geometry: LGeometry): number => geometry.xFootEnd - geometry.xL;

export const geometryHeight = (geometry: LGeometry): number => geometry.yBottom - geometry.yTop;

export const distanceFromCenter = distanceToCenter;
