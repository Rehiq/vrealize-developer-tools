import Zip from 'adm-zip';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import { Logger } from "winston";
import { PackagerOptions, BundleFileset } from "../lib/model";

export interface IStrategy {
    packageProject(): Promise<void>
}

export abstract class BaseStrategy implements IStrategy {

    protected readonly DEPENDENCY_TEMP_DIR: string;

    constructor(protected readonly logger: Logger, protected readonly options: PackagerOptions, protected readonly phaseCb: Function) {
        this.DEPENDENCY_TEMP_DIR = path.join(path.resolve(options.workspace), 'tmp');
    }

    protected async zipFiles(filesets: Array<BundleFileset>) {
        const zip = new Zip();

        filesets.forEach(fileset => {
            const { files: filesToBundle, baseDir } = fileset;
            for (var i = 0; i < filesToBundle.length; i++) {
                const filePath = filesToBundle[i];
                const zipPath = path.dirname(path.relative(baseDir, filePath));
                zip.addLocalFile(filePath, zipPath);
                this.logger.debug(`Packaged: ${filePath}`);
            }
        })

        await fs.ensureDir(path.dirname(this.options.bundle));
        zip.writeZip(this.options.bundle);
        this.logger.info(`Created ${this.options.bundle}`);
    }

    protected getHash(hashable: string) {
        return crypto.createHash('sha256').update(hashable).digest('hex');
    }

    protected async writeDepsHash(hashable: string) {
        const hash = this.getHash(hashable);
        const file = path.join(this.DEPENDENCY_TEMP_DIR, 'deps.sha256');
        await fs.writeFile(file, hash, { encoding: 'utf-8' });
    }

    protected async readDepsHash(): Promise<string | null> {
        const file = path.join(this.DEPENDENCY_TEMP_DIR, 'deps.sha256');
        const exists = await fs.pathExists(file);
        if (exists) {
            return await fs.readFile(file, 'utf-8');
        } else {
            return null;
        }
    }

    abstract async packageProject(): Promise<void>;

}