# Lens Next Build 13 — quaternion validation and comparison contract

Date: 2026-09-03

Rollback checkpoint: `757cd4c6614f69e9357d00907a0a373870da711a`

## Validity policy

A stored/export quaternion is valid for orientation comparison when all four components are finite and at least one component is mathematically non-zero. There is no arbitrary near-zero rejection tolerance. Any finite non-zero quaternion represents the same orientation as every non-zero scalar multiple of itself, and the comparison implementation can safely normalize values as small as `double.Epsilon` by scaling first.

Reject:

- missing quaternion;
- exact zero `(0,0,0,0)`;
- NaN in any component;
- positive or negative infinity in any component.

Slightly non-unit finite quaternions remain valid and untouched. Large finite components also remain valid when their scale-safe normalized comparison copy is finite.

## Scale-safe norm evaluation

For validation/comparison only:

1. `scale = max(|A|, |B|, |C|, |D|)`;
2. reject when `scale == 0`;
3. calculate scaled components `s = q / scale`;
4. calculate `scaledMagnitude = sqrt(sa² + sb² + sc² + sd²)`;
5. calculate the ephemeral unit comparison quaternion `qHat = s / scaledMagnitude`.

This avoids underflow for very small non-zero components and intermediate overflow for components near `double.MaxValue`. Neither stored BIMLog values nor XML values are rewritten.

## Spatial equivalence and tolerance

For two validated rotations, calculate ephemeral normalized copies and:

`angularError = 2 * acos(clamp(abs(dot(qHat1, qHat2)), 0, 1))`

The absolute dot product makes `q` and `-q` equivalent. Clamping prevents floating-point overshoot from making `acos` invalid.

The later XML-import acceptance tolerance is:

`1e-6 radians` (approximately `0.0000573 degrees`).

This is larger than the observed binary64 normalization noise for exact sign-equivalent representative quaternions (approximately `4.22e-8` radians) and accepts a representative quaternion quantized through the installed Navisworks XML schema's `xs:float` component boundary. It remains small enough to reject a deliberately introduced `2e-6` radian orientation difference. This is an acceptance-comparison tolerance only, not a validity cutoff or export transformation.

## Proof cases

The focused suite passes `87/87`, including:

- identity, normalized single-axis, and normalized compound rotations;
- exact negated `q/-q` equivalence;
- slightly non-unit scalar multiple equivalence;
- `double.Epsilon` non-zero components;
- exact zero rejection;
- NaN and both infinities rejection;
- scale-safe comparison with `double.MaxValue` components;
- representative float32 component quantization within `1e-6` radians;
- a `2e-6` radian difference rejected;
- identical Build 12 XML bytes before and after comparison evaluation;
- exact invariant `R` serialization of original stored values/signs;
- unchanged position and `SourceLinearUnit` input;
- absence of up, projection, focal/FOV, sectioning, units, schema URL, and new camera elements.

## Regression

The complete `scripts/test-lens-next-n10-p05-regression.ps1` gate passes:

- focused/core contracts: `87/87`;
- Navisworks 2021 adapter contracts: `54/54`;
- Platform atomic-create source contract: PASS;
- create/capture UI source contract: PASS;
- Open Working View source contracts: PASS;
- `REGRESSION_GATE_RESULT=PASS`.

Build 13 changes only test/evidence files. Build 12 production serialization, native capture/restore, Platform, database/schema, deployment, packages, and the immutable N10-P05 fallback are unchanged.
