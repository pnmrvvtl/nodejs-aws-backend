export type ProductItem = {
  id: string;
  title: string;
  description: string;
  price: number;
};

export type StockItem = {
  product_id: string;
  count: number;
};

export type ProductResponse = ProductItem & {
  count: number;
};

export type CreateProductRequest = {
  title: string;
  description: string;
  price: number;
  count: number;
};


export function isProductItem(item: unknown): item is ProductItem {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  const product = item as Record<string, unknown>;

  return (
    typeof product.id === "string" &&
    typeof product.title === "string" &&
    typeof product.description === "string" &&
    typeof product.price === "number"
  );
}

export function isStockItem(item: unknown): item is StockItem {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  const stock = item as Record<string, unknown>;

  return typeof stock.product_id === "string" && typeof stock.count === "number";
}


export function isCreateProductRequest(item: unknown): item is CreateProductRequest {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  const product = item as Record<string, unknown>;

  return (
    typeof product.title === "string" &&
    product.title.trim().length > 0 &&
    typeof product.description === "string" &&
    product.description.trim().length > 0 &&
    typeof product.price === "number" &&
    Number.isFinite(product.price) &&
    product.price > 0 &&
    typeof product.count === "number" &&
    Number.isInteger(product.count) &&
    product.count >= 0
  );
}
