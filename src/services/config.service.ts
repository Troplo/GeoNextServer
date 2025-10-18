import { Injectable, Logger } from '@nestjs/common';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import { GeoServerConfig } from '../classes/config/GeoConfig';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly config: GeoServerConfig;

  constructor() {
    const config = fs.readFileSync(
      `${this.getBaseFolder()}/config/geoserver.json`,
      'utf-8',
    );
    try {
      this.config = JSON.parse(config) as GeoServerConfig;
    } catch (error) {
      throw new Error(
        `Unable to load config file. Please copy config/geoserver.example.json to config/geoserver.json and fill in the required values. Debug info: ${error}`,
      );
    }
  }

  get<K extends keyof GeoServerConfig>(key: K): GeoServerConfig[K] {
    const value = this.config[key];
    assert(value !== undefined, `Configuration key "${String(key)}" not found`);
    return value;
  }

  set<K extends keyof GeoServerConfig>(
    key: K,
    value: GeoServerConfig[K],
  ): void {
    this.config[key] = value;
    this.writeConfig();
  }

  getBaseFolder(): string {
    if (!process.env._GEOSERVER_ROOT_PATH) {
      throw new Error('Base folder not set!');
    }
    return process.env._GEOSERVER_ROOT_PATH;
  }

  /**
   * Writes a user content file to the usercontent folder.
   * This does not have any security checks, such as path traversal protection, this should be handled by the caller.
   * @param {string} name
   * @param {Buffer} content
   * @returns {boolean}
   */
  writeUserContentFile(name: string, content: Buffer) {
    const fullPath = `${this.getBaseFolder()}/usercontent/${name}`;
    try {
      fs.mkdirSync(`${this.getBaseFolder()}/usercontent`, { recursive: true });
      fs.writeFileSync(fullPath, content);
      this.logger.debug(`User content file written to ${fullPath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to write user content file: ${error}`);
      return false;
    }
  }

  deleteUserContentFile(name: string): boolean {
    if (!name || name.includes('..')) {
      this.logger.error(`Invalid file name: ${name}`);
      return false;
    }
    const fullPath = `${this.getBaseFolder()}/usercontent/${name}`;
    try {
      fs.unlinkSync(fullPath);
      this.logger.debug(`User content file deleted: ${fullPath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete user content file: ${error}`);
      return false;
    }
  }

  getSrcBaseFolder(): string {
    return `${this.getBaseFolder()}/src`;
  }

  private writeConfig(): boolean {
    try {
      fs.writeFileSync(
        `${this.getBaseFolder()}/config/geoserver.json`,
        JSON.stringify(this.config, null, 2),
      );
      return true;
    } catch (error) {
      this.logger.fatal(`Failed to write config file: ${error}`);
      return false;
    }
  }
}
