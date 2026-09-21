// Demonstrates the allowed dependency direction: apps -> packages (Rule 8).
import { APP_NAME } from "@kantorcore/config";

export const boot = (): string => `${APP_NAME} web app`;
