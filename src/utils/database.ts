import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    return customName ?? snakeCase(embeddedPrefixes.concat(propertyName).join('_'));
  }

  tableName(targetName: string, customName: string): string {
    return customName ?? snakeCase(targetName);
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }
}
