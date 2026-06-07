export const getOperationCounterKey = (year: number) => `OPS-${year}`;

export const formatOperationCode = (year: number, sequence: number) =>
  `OPS-${year}-${sequence.toString().padStart(4, '0')}`;
