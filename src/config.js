export const HTTP_PORT = Number(process.env.HTTP_PORT || 8081);
export const MQTT_TCP_PORT = Number(process.env.MQTT_TCP_PORT || 1883);
export const WS_PATH = process.env.WS_PATH || "/mqtt";
export const LOG_LEVEL = process.env.LOG_LEVEL || "info";
export const DEMO = false;
