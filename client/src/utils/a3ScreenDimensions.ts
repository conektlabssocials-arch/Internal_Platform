const SCREEN_ASPECT_WIDTH = 16;
const SCREEN_ASPECT_HEIGHT = 9;
const INCHES_PER_FOOT = 12;

const roundDimension = (value: number) => Math.round(value * 100) / 100;

const parsePositiveNumber = (value?: string) => {
  const match = value?.match(/\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : 0;
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

const formatDiagonal = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const updateA3ScreenDimensions = (
  form: { width: string; height: string; screenSize: string },
  field: 'width' | 'height' | 'screenSize',
  value: string,
) => {
  const next = { ...form, [field]: value };
  const numericValue = parsePositiveNumber(value);
  if (!numericValue) return next;

  if (field === 'screenSize') {
    const ratioDiagonal = Math.hypot(SCREEN_ASPECT_WIDTH, SCREEN_ASPECT_HEIGHT);
    next.width = String(
      roundDimension(
        (numericValue * SCREEN_ASPECT_WIDTH) / ratioDiagonal / INCHES_PER_FOOT,
      ),
    );
    next.height = String(
      roundDimension(
        (numericValue * SCREEN_ASPECT_HEIGHT) / ratioDiagonal / INCHES_PER_FOOT,
      ),
    );
    return next;
  }

  const widthFeet =
    field === 'width'
      ? numericValue
      : (numericValue * SCREEN_ASPECT_WIDTH) / SCREEN_ASPECT_HEIGHT;
  const heightFeet =
    field === 'height'
      ? numericValue
      : (numericValue * SCREEN_ASPECT_HEIGHT) / SCREEN_ASPECT_WIDTH;
  const diagonalInches = Math.hypot(
    widthFeet * INCHES_PER_FOOT,
    heightFeet * INCHES_PER_FOOT,
  );

  next.width = String(roundDimension(widthFeet));
  next.height = String(roundDimension(heightFeet));
  next.screenSize = `${formatDiagonal(diagonalInches)} inch LED TV`;
  return next;
};
