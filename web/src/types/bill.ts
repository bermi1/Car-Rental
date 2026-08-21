/** The itemised cost of one rental, as the API works it out. */
export interface BillLine {
  label: string;
  detail?: string;
  amount: number;
}

export interface Bill {
  currency: string;
  lines: BillLine[];
  subtotal: number;
  paid: number;
  balance: number;
  /** Days the car was kept beyond the agreed return date. */
  late_days: number;
}
