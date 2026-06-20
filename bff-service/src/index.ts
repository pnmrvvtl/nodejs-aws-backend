import { getPort, getServiceConfig } from "./config";
import { createBffServer } from "./server";

const port = getPort();
const server = createBffServer(getServiceConfig());

server.listen(port, () => {
  console.log(`BFF service is running on ${port}`);
});
