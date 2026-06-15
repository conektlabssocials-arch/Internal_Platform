const SCREEN_ASPECT_WIDTH = 16;
const SCREEN_ASPECT_HEIGHT = 9;
const INCHES_PER_FOOT = 12;

const roundDimension = (value: number) => Math.round(value * 100) / 100;

const positiveNumber = (value?: number) =>
  Number.isFinite(value) && Number(value) > 0 ? Number(value) : undefined;

const diagonalFromScreenSize = (screenSize?: string) => {
  const match = screenSize?.match(/\d+(?:\.\d+)?/);
  const value = match ? Number(match[0]) : 0;
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const formatDiagonal = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const completeA3ScreenDimensions = ({
  screenSize,
  width,
  height,
}: {
  screenSize?: string;
  width?: number;
  height?: number;
}) => {
  const normalizedWidth = positiveNumber(width);
  const normalizedHeight = positiveNumber(height);
  const diagonalInches = diagonalFromScreenSize(screenSize);

  if (normalizedWidth && normalizedHeight) {
    return {
      width: normalizedWidth,
      height: normalizedHeight,
      screenSize:
        screenSize ||
        `${formatDiagonal(
          Math.hypot(
            normalizedWidth * INCHES_PER_FOOT,
            normalizedHeight * INCHES_PER_FOOT,
          ),
        )} inch LED TV`,
    };
  }

  if (diagonalInches) {
    const ratioDiagonal = Math.hypot(SCREEN_ASPECT_WIDTH, SCREEN_ASPECT_HEIGHT);
    return {
      screenSize,
      width: roundDimension(
        (diagonalInches * SCREEN_ASPECT_WIDTH) /
          ratioDiagonal /
          INCHES_PER_FOOT,
      ),
      height: roundDimension(
        (diagonalInches * SCREEN_ASPECT_HEIGHT) /
          ratioDiagonal /
          INCHES_PER_FOOT,
      ),
    };
  }

  if (normalizedWidth || normalizedHeight) {
    const widthFeet =
      normalizedWidth ||
      (normalizedHeight! * SCREEN_ASPECT_WIDTH) / SCREEN_ASPECT_HEIGHT;
    const heightFeet =
      normalizedHeight ||
      (normalizedWidth! * SCREEN_ASPECT_HEIGHT) / SCREEN_ASPECT_WIDTH;
    return {
      width: roundDimension(widthFeet),
      height: roundDimension(heightFeet),
      screenSize: `${formatDiagonal(
        Math.hypot(
          widthFeet * INCHES_PER_FOOT,
          heightFeet * INCHES_PER_FOOT,
        ),
      )} inch LED TV`,
    };
  }

  return { screenSize, width, height };
};
