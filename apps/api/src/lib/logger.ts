import pino from 'pino'
import { REDACT_PATHS, safeError } from './log-safe'

export function createLogger(destination?: pino.DestinationStream): pino.Logger {
  const options: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? 'info',
    // Hata nesneleri axios/Prisma ayrintilarini (URL, govde, arguman degerleri) tasir: yalniz guvenli ozet yazilir.
    serializers: { err: safeError, error: safeError },
    redact: { paths: REDACT_PATHS, censor: '[gizli]' },
    transport:
      !destination && process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
        : undefined,
  }
  return destination ? pino(options, destination) : pino(options)
}

export const logger = createLogger()
