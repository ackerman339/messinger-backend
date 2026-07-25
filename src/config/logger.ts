import winston from 'winston';
const { combine, timestamp, errors, printf, json } = winston.format;

const COLORS: Record<string, string> = {
  info: '[37m', // white
  warn: '[33m', // yellow
  error: '[31m', // red
  http: '[34m', // blue
};
const RESET = '[0m';

const pretty = printf(({ level, message, timestamp, stack, ...meta }) => {
  const ESC = String.fromCharCode(27);
  const cleanLevel = level.replace(`${ESC}\\[[0-9;]*m`, 'g');
  const color = COLORS[cleanLevel] ?? COLORS.info;
  const output = JSON.stringify(
    {
      timestamp,
      level: cleanLevel,
      message: stack || message,
      ...meta,
    },
    null,
    2
  );

  return output
    .split('\n')
    .map((line) => `${color}${line}${RESET}`)
    .join('\n');
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV !== 'production' ? 'http' : 'info',
  format: combine(timestamp(), errors({ stack: true })),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV !== 'production' ? combine(pretty) : json(),
    }),
  ],
});
