import fs from 'fs';
import { join } from 'path';

export const PACKAGE_ROOT = join(__dirname, '..'); // Relative to compiled JS file in `dist/`.

export type ThenArg<T> = T extends PromiseLike<infer U> ? U : T; // Unwrap promise.

export function getDirectories(path: string): string[] {
  return fs
    .readdirSync(path, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

export function getFiles(path: string): string[] {
  return fs
    .readdirSync(path, { withFileTypes: true })
    .filter((dirent) => !dirent.isDirectory())
    .map((dirent) => dirent.name);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
