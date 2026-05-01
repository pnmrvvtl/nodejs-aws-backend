export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  count: number;
};

export const products: Product[] = [
  { id: "1", title: "Product One", description: "Description for product one", price: 24, count: 5 },
  { id: "2", title: "Product Two", description: "Description for product two", price: 15, count: 10 },
  { id: "3", title: "Product Three", description: "Description for product three", price: 32, count: 3 },
  { id: "4", title: "Product Four", description: "Description for product four", price: 8, count: 20 },
];
