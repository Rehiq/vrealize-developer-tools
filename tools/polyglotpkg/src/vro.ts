import fs from 'fs-extra';
import path from 'path';
import { v5 as uuidv5 } from 'uuid';
import { Logger } from "winston";
import { PackagerOptions, VroActionDefinition, ActionType } from "./lib/model";
import { getActionManifest, determineRuntime } from "./lib/utils";
import { create as createXML } from 'xmlbuilder2';

/**
 * Create vRO tree structure that can be later converted to a vRO package
 */
export class VroTree {

    private readonly treeDir: string;
    private readonly scriptModuleDir: string
    private readonly DEFAULT_VERSION = '1.0.0';
    private readonly DEFAULT_MEMORY_LIMIT_MB = 64;
    private readonly DEFAULT_TIMEOUT_SEC = 180;

    constructor(private readonly logger: Logger, private readonly options: PackagerOptions) {
        this.treeDir = options.vro;
        this.scriptModuleDir = path.join(this.options.vro, 'src', 'main', 'resources', 'ScriptModule');
    }

    async createTree() {
        this.logger.info('Creating vRO tree structure...');
        const actionDefintion = await getActionManifest(this.options.workspace) as VroActionDefinition;

        // create structure
        await fs.ensureDir(this.scriptModuleDir);

        await this.generatePOM(actionDefintion);
        await this.generateAction(actionDefintion);
        await this.generateMeta(actionDefintion);
        await this.generateTags(actionDefintion);
        await this.copyBundle(actionDefintion);

    }

    private async generatePOM(actionDefintion: VroActionDefinition) {

        const content = {
            project: {
                '@xmlns': 'http://maven.apache.org/POM/4.0.0',
                '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                '@xsi:schemaLocation': 'http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd',
                modelVersion: '4.0.0',
                groupId: actionDefintion.vro.module,
                artifactId: actionDefintion.platform.action,
                version: actionDefintion.version || this.DEFAULT_VERSION,
                packaging: 'package',
            }
        }

        const doc = createXML({ version: '1.0', encoding: 'UTF-8' }, content)
        const xml = doc.end({ prettyPrint: true });
        await fs.writeFile(path.join(this.treeDir, 'pom.xml'), xml);
    }

    private async generateAction(actionDefintion: VroActionDefinition) {

        const runtime = await determineRuntime(this.options.workspace, <ActionType>this.options.env);

        const content = {
            'dunes-script-module': {
                '@name': actionDefintion.platform.action,
                '@result-type': actionDefintion.vro.outputType,
                '@api-version': '6.0.0',
                '@id': this.getId(actionDefintion),
                '@version': (actionDefintion.version || this.DEFAULT_VERSION).replace('-SNAPSHOT', ''),
                '@allowed-operations': 'vfe',
                '@memory-limit': (actionDefintion.platform.memoryLimitMb || this.DEFAULT_MEMORY_LIMIT_MB) * 1024 * 1024,
                '@timeout': actionDefintion.platform.timeoutSec || this.DEFAULT_TIMEOUT_SEC,
                description: { '$': actionDefintion.description || '' },
                runtime: { '$': runtime },
                'entry-point': { '$': actionDefintion.platform.entrypoint },
                ...( actionDefintion.vro.inputs && { param: Object.entries(actionDefintion.vro.inputs).map(([inputName, inputType]) => ({
                    '@n': inputName,
                    '@t': inputType
                })) }),
            }
        }

        const doc = createXML({ version: '1.0', encoding: 'UTF-8' }, content)
        const xml = doc.end({ prettyPrint: true });
        await fs.writeFile(path.join(this.scriptModuleDir, `${actionDefintion.platform.action}.xml`), xml);

    }

    private async generateMeta(actionDefintion: VroActionDefinition) {

        const content = {
            'properties': {
                comment: 'UTF-16',
                entry: [
                    { '@key': 'categoryPath', '#': actionDefintion.vro.module, },
                    { '@key': 'type', '#': 'ScriptModule', },
                    { '@key': 'id', '#': this.getId(actionDefintion), },
                    // TODO: check whether we need signature-owner
                ]
            }
        }

        // TODO: generate doctype:
        // <!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">

        const doc = createXML({ version: '1.0', encoding: 'UTF-8', standalone: false }, content);
        const xml = doc.end({ prettyPrint: true });
        await fs.writeFile(path.join(this.scriptModuleDir, `${actionDefintion.platform.action}.element_info.xml`), xml);

    }

    private async generateTags(actionDefintion: VroActionDefinition) {

        const content = {
            'tags': {
                tag: (actionDefintion.platform.tags || []).map(t => ({ '@name': t, '@global': true}))
            }
        }

        const doc = createXML({ version: '1.0', encoding: 'UTF-8' }, content);
        const xml = doc.end({ prettyPrint: true });
        await fs.writeFile(path.join(this.scriptModuleDir, `${actionDefintion.platform.action}.tags.xml`), xml);
    }

    private async copyBundle(actionDefintion: VroActionDefinition) {
        const source = this.options.bundle;
        const dest = path.join(this.scriptModuleDir, `${actionDefintion.platform.action}.bundle.zip`);
        await fs.copyFile(source, dest);
    }

    private getId(actionDefintion: VroActionDefinition) {
        return actionDefintion.vro.id || uuidv5(`${actionDefintion.vro.module}:${actionDefintion.platform.action}`, uuidv5.DNS)
    }

}
