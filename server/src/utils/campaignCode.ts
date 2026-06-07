export const getCampaignCounterKey = (year: number) => `CMP-${year}`;

export const formatCampaignCode = (year: number, sequence: number) =>
  `CMP-${year}-${sequence.toString().padStart(4, '0')}`;
