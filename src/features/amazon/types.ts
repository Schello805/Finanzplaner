export interface AmazonOrderItem {
  orderId: string;
  orderDate: string;
  shipDate?: string;
  asin: string;
  productName: string;
  department?: string;
  status: string;
  quantity: number;
  unitPrice: number;
  unitTax: number;
  orderTotal: number;
  shippingCharge: number;
  totalDiscounts: number;
  currency: string;
  fingerprint: string;
}

export interface AmazonOrderImportResult {
  items: AmazonOrderItem[];
  orderCount: number;
  warnings: string[];
}
