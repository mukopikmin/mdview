export const formatLogMessage = (message: string, timestamp: Date): string =>
  `[${timestamp.toISOString()}] ${message}`;

export const logInfo = (message: string): void => {
  console.log(formatLogMessage(message, new Date()));
};

export const logError = (message: string): void => {
  console.error(formatLogMessage(message, new Date()));
};
