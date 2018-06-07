import winston from 'winston'
import { Papertrail } from 'winston-papertrail'
import os from 'os'

const { PAPERTRAIL_HOST, PAPERTRAIL_PORT, PAPERTRAIL_HOSTNAME } = process.env
const logger = new winston.Logger();

if (PAPERTRAIL_HOST && PAPERTRAIL_PORT) {
  const hostname = PAPERTRAIL_HOSTNAME ? PAPERTRAIL_HOSTNAME : os.hostname()
  logger.add(Papertrail, {
    hostname,
    host: PAPERTRAIL_HOST,
    port: PAPERTRAIL_PORT,
    program: "mtg-bot"
  })
} else {
  logger.add(winston.transports.Console, {})
}

export default logger
