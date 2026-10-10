import { Request } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: any;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  requestId?: string;
}

export interface CustomerAuthPayload {
  userId: number;
  phone: string;
  isVerified: boolean;
}

export interface AdminAuthPayload {
  adminId: number;
  email: string;
  roleId: number;
  roleName: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  id?: string;
  customer?: CustomerAuthPayload;
  admin?: AdminAuthPayload;
}

export interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  weightGrams: number;
  barcode: string | null;
  isActive: boolean;
  attributes?: {
    size?: string;
    color?: string;
    fabric?: string;
    [key: string]: any;
  };
}

export type AudienceScope = 'MEN' | 'WOMEN' | 'ALL';

export interface CategoryItem {
  id: number;
  parentId?: number | null;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  audience: AudienceScope;
  isActive: boolean;
  displayOrder: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  productCount?: number;
  subcategories?: CategoryItem[];
  parentName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductImage {
  id: number;
  productId: number;
  s3Key: string;
  s3Url: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
  viewType?: string;
}

export interface ProductItem {
  id: number;
  categoryId: number;
  subcategoryId?: number | null;
  categoryName?: string;
  categorySlug?: string;
  subcategoryName?: string;
  subcategorySlug?: string;
  audience: AudienceScope;
  name: string;
  slug: string;
  skuBase: string;
  shortDescription: string;
  description: string;
  fabric: string | null;
  materials?: string | null;
  pattern: string | null;
  style: string | null;
  colors?: any;
  careInstructions: string | null;
  tags?: any;
  basePrice: number;
  salePrice: number | null;
  displayOrder?: number;
  isFeatured: boolean;
  isBestseller: boolean;
  isNewArrival: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  averageRating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItemCalculated {
  id: number;
  cartId: number;
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  variantSku: string;
  quantity: number;
  unitPrice: number;
  compareAtPrice: number | null;
  subtotal: number;
  imageUrl: string;
  stockAvailable: number;
  isAvailable: boolean;
  attributes: Record<string, string>;
}

export interface CartSummary {
  items: CartItemCalculated[];
  totalQuantity: number;
  subtotal: number;
  discount: number;
  shippingCharge: number;
  codCharge: number;
  tax: number;
  grandTotal: number;
  appliedCoupon: string | null;
}
