import pino from 'pino'

export function createLogger(destination?: pino.DestinationStream): pino.Logger {
  const options: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      !destination && process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
        : undefined,
  }
  return destination ? pino(options, destination) : pino(options)
}

export const logger = createLogger()
