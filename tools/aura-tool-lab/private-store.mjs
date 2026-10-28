import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

export const defaultStateDirectory = path.join(os.homedir(), 'Library', 'Application Support', 'AuraToolLab');

// Separate from Aura's real profile. Never put credentials in the checkout.
export class PrivateStore {
  constructor(directory = defaultStateDirectory) { this.directory = path.resolve(directory); }
  async prepare() {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(this.directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(this.directory) !== this.directory || (process.getuid && stat.uid !== process.getuid())) throw new Error('Unsafe credential directory');
    await fs.chmod(this.directory, 0o700);
  }
  file(name) {
    if (!/^[a-z][a-z0-9-]*\.json$/.test(name)) throw new Error('Invalid private file name');
    return path.join(this.directory, name);
  }
  async read(name) {
    await this.prepare();
    let handle;
    try {
      handle = await fs.open(this.file(name), constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 128 * 1024 || stat.mode & 0o077 || (process.getuid && stat.uid !== process.getuid())) throw new Error('Unsafe credential file');
      return JSON.parse(await handle.readFile('utf8'));
    } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
    finally { await handle?.close(); }
  }
  async write(name, value) {
    await this.prepare();
    const file = this.file(name);
    const prior = await fs.lstat(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (prior && (!prior.isFile() || prior.isSymbolicLink() || (process.getuid && prior.uid !== process.getuid()))) throw new Error('Unsafe credential file');
    const temporary = path.join(this.directory, `${randomUUID()}.tmp`);
    await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
    try { await fs.rename(temporary, file); }
    finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
}
