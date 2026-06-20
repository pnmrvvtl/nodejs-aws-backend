export type ServiceName = "product" | "cart";

export type ServiceConfig = Record<ServiceName, string>;

export function getPort(): number {
  const value = process.env.APP_PORT ?? process.env.PORT;
  const port = Number(value);

  return Number.isFinite(port) && port > 0 ? port : 4000;
}

export function getServiceConfig(): ServiceConfig {
  return {
    product: getRequiredServiceUrl("product"),
    cart: getRequiredServiceUrl("cart"),
  };
}

function getRequiredServiceUrl(name: ServiceName): string {
  const value = process.env[name] ?? process.env[name.toUpperCase()];

  if (!value) {
    throw new Error(`Missing service URL: ${name}`);
  }

  return value.replace(/\/$/, "");
}
