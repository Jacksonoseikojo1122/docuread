import type { DocType } from "../src/schemas.js";

/**
 * Synthetic documents with known answers. No real people, businesses or IDs.
 * `expected` holds normalised values: ISO dates, integer minor units for money,
 * ISO currency codes, plain text. null means "not on the document".
 * `mustReview` marks cases that should land in the review queue whatever the
 * model reads (e.g. the printed totals don't add up).
 */
export type Case = {
  id: string;
  type: DocType;
  note: string;
  style?: "faded" | "handwritten" | "skewed";
  mustReview?: boolean;
  printed: Record<string, string>; // what appears on the page
  expected: Record<string, string | number | null>;
};

export const CASES: Case[] = [
  {
    id: "receipt-gh-supermarket",
    type: "receipt",
    note: "Accra supermarket, cedi symbol, VAT and levies on one line",
    printed: { merchant: "Osu Fresh Mart", date: "14/09/2026", currency: "GH₵", subtotal: "212.40", tax: "Levies & VAT 46.73", total: "259.13" },
    expected: { merchant_name: "Osu Fresh Mart", date: "2026-09-14", currency: "GHS", subtotal: 21240, tax: 4673, total: 25913 },
  },
  {
    id: "receipt-us-cafe",
    type: "receipt",
    note: "US cafe, dollar sign, month-first date",
    printed: { merchant: "Maple Street Coffee", date: "09/03/2026", currency: "$", subtotal: "11.50", tax: "0.92", total: "12.42" },
    expected: { merchant_name: "Maple Street Coffee", date: "2026-09-03", currency: "USD", subtotal: 1150, tax: 92, total: 1242 },
  },
  {
    id: "receipt-faded-fuel",
    type: "receipt",
    style: "faded",
    note: "Thermal fuel receipt, low contrast",
    printed: { merchant: "Kasoa Fuel Station", date: "02/10/2026", currency: "GHS", subtotal: "", tax: "", total: "350.00" },
    expected: { merchant_name: "Kasoa Fuel Station", date: "2026-10-02", currency: "GHS", subtotal: null, tax: null, total: 35000 },
  },
  {
    id: "receipt-bad-totals",
    type: "receipt",
    mustReview: true,
    note: "Printed subtotal + tax does not equal total; must go to review",
    printed: { merchant: "Labone Pharmacy", date: "21/08/2026", currency: "GHS", subtotal: "80.00", tax: "12.00", total: "99.00" },
    expected: { merchant_name: "Labone Pharmacy", date: "2026-08-21", currency: "GHS", subtotal: 8000, tax: 1200, total: 9900 },
  },
  {
    id: "invoice-gh-services",
    type: "invoice",
    note: "Ghana IT services invoice with due date",
    printed: { number: "INV-2026-0187", issuer: "Kente Code Studio Ltd", customer: "Adwoa Mensah Bakery", issue: "1 October 2026", due: "31 October 2026", currency: "GHS", subtotal: "4,500.00", tax: "1,042.88", total: "5,542.88" },
    expected: { invoice_number: "INV-2026-0187", issuer_name: "Kente Code Studio Ltd", customer_name: "Adwoa Mensah Bakery", issue_date: "2026-10-01", due_date: "2026-10-31", currency: "GHS", subtotal: 450000, tax: 104288, total: 554288 },
  },
  {
    id: "invoice-uk-consulting",
    type: "invoice",
    note: "UK invoice in pounds, no customer name",
    printed: { number: "1042", issuer: "Thames Ledger Consulting", customer: "", issue: "2026-07-15", due: "2026-08-14", currency: "£", subtotal: "1,200.00", tax: "240.00", total: "1,440.00" },
    expected: { invoice_number: "1042", issuer_name: "Thames Ledger Consulting", customer_name: null, issue_date: "2026-07-15", due_date: "2026-08-14", currency: "GBP", subtotal: 120000, tax: 24000, total: 144000 },
  },
  {
    id: "invoice-skewed",
    type: "invoice",
    style: "skewed",
    note: "Photographed at an angle",
    printed: { number: "A-77", issuer: "Tema Logistics", customer: "Northgate Traders", issue: "12/09/2026", due: "26/09/2026", currency: "GHS", subtotal: "900.00", tax: "0.00", total: "900.00" },
    expected: { invoice_number: "A-77", issuer_name: "Tema Logistics", customer_name: "Northgate Traders", issue_date: "2026-09-12", due_date: "2026-09-26", currency: "GHS", subtotal: 90000, tax: 0, total: 90000 },
  },
  {
    id: "invoice-due-before-issue",
    type: "invoice",
    mustReview: true,
    note: "Due date printed before the issue date; must go to review",
    printed: { number: "INV-88", issuer: "Coastline Prints", customer: "Ridge School", issue: "2026-09-20", due: "2026-09-10", currency: "USD", subtotal: "300.00", tax: "0.00", total: "300.00" },
    expected: { invoice_number: "INV-88", issuer_name: "Coastline Prints", customer_name: "Ridge School", issue_date: "2026-09-20", due_date: "2026-09-10", currency: "USD", subtotal: 30000, tax: 0, total: 30000 },
  },
  {
    id: "cert-cpr",
    type: "certificate",
    note: "CPR certificate with expiry",
    printed: { holder: "Ama Owusu", ctype: "Basic Life Support (CPR & AED)", issuer: "Lifeline Training Institute", number: "BLS-55102", issue: "March 4, 2026", expiry: "March 4, 2028" },
    expected: { holder_name: "Ama Owusu", certificate_type: "Basic Life Support (CPR & AED)", issuer: "Lifeline Training Institute", certificate_number: "BLS-55102", issue_date: "2026-03-04", expiry_date: "2028-03-04" },
  },
  {
    id: "cert-no-expiry",
    type: "certificate",
    note: "Degree-style certificate with no expiry date",
    printed: { holder: "Kwesi Boateng", ctype: "Certificate in Food Hygiene", issuer: "Coastal Skills Academy", number: "", issue: "18 June 2025", expiry: "" },
    expected: { holder_name: "Kwesi Boateng", certificate_type: "Certificate in Food Hygiene", issuer: "Coastal Skills Academy", certificate_number: null, issue_date: "2025-06-18", expiry_date: null },
  },
  {
    id: "cert-handwritten",
    type: "certificate",
    style: "handwritten",
    note: "Name and dates filled in by hand",
    printed: { holder: "Efua Asante", ctype: "First Aid at Work", issuer: "Volta Safety Council", number: "FA-3391", issue: "05/01/2026", expiry: "05/01/2029" },
    expected: { holder_name: "Efua Asante", certificate_type: "First Aid at Work", issuer: "Volta Safety Council", certificate_number: "FA-3391", issue_date: "2026-01-05", expiry_date: "2029-01-05" },
  },
  {
    id: "cert-expired",
    type: "certificate",
    note: "Expired certificate: values are fine, the 'expired' flag must be raised",
    printed: { holder: "Yaw Darko", ctype: "Food Handler Permit", issuer: "Metro Health Directorate", number: "FHP-2210", issue: "2023-02-01", expiry: "2025-02-01" },
    expected: { holder_name: "Yaw Darko", certificate_type: "Food Handler Permit", issuer: "Metro Health Directorate", certificate_number: "FHP-2210", issue_date: "2023-02-01", expiry_date: "2025-02-01" },
  },
];
