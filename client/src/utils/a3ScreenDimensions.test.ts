import { describe, expect, it } from 'vitest';

import { updateA3ScreenDimensions } from './a3ScreenDimensions';

const empty = { width: '', height: '', screenSize: '' };

describe('A3 screen dimension calculation', () => {
  it('calculates physical dimensions from diagonal screen size', () => {
    expect(
      updateA3ScreenDimensions(empty, 'screenSize', '32 inch LED TV'),
    ).toEqual({
      screenSize: '32 inch LED TV',
      width: '2.32',
      height: '1.31',
    });
  });

  it('calculates height and diagonal screen size from width', () => {
    expect(updateA3ScreenDimensions(empty, 'width', '2.32')).toEqual({
      width: '2.32',
      height: '1.31',
      screenSize: '31.9 inch LED TV',
    });
  });

  it('calculates width and diagonal screen size from height', () => {
    expect(updateA3ScreenDimensions(empty, 'height', '1.31')).toEqual({
      width: '2.33',
      height: '1.31',
      screenSize: '32.1 inch LED TV',
    });
  });
});
