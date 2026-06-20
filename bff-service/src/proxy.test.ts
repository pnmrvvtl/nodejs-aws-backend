import { clearCache } from "./cache";
import { proxyRequest } from "./proxy";

const services = {
  product: "https://product.test",
  cart: "https://cart.test",
};

describe("proxyRequest", () => {
  beforeEach(() => {
    clearCache();
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify([{ id: "1" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
  });

  it("returns 502 for unknown service", async () => {
    const response = await proxyRequest(
      {
        method: "GET",
        url: "/unknown/products",
        headers: {},
        body: Buffer.from(""),
      },
      services,
    );

    expect(response.status).toBe(502);
    expect(response.body.toString()).toBe("Cannot process request");
  });

  it("proxies product request", async () => {
    await proxyRequest(
      {
        method: "GET",
        url: "/product/products",
        headers: {},
        body: Buffer.from(""),
      },
      services,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://product.test/products",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("caches product list request", async () => {
    await proxyRequest(
      {
        method: "GET",
        url: "/product/products",
        headers: {},
        body: Buffer.from(""),
      },
      services,
    );
    await proxyRequest(
      {
        method: "GET",
        url: "/product/products",
        headers: {},
        body: Buffer.from(""),
      },
      services,
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
