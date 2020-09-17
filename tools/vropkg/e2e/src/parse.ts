import "jasmine";
import * as fs from "fs-extra";
import * as path from "path";
import * as glob from "glob";
import * as child_process from "child_process";
import * as unzipper from 'unzipper';


describe("End-to-End Tests", () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

    let childProcLogs = process.env.CHILD_PROC_LOGS == "true" || process.env.CHILD_PROC_LOGS == "1";

    const currentPath = process.cwd();

    const runCase = (caseName, caseArguments) => {
        if (childProcLogs) {
            console.info(
                "Executing case args",
                caseArguments.map(arg => `'${arg}'`).join(" ")
            );
        }

        const childProcess = child_process.spawn("node", caseArguments, {
            cwd: currentPath,
            env: process.env
        });

        childProcess.stdout.on("data", function (data) {
            if (childProcLogs) {
                console.log(`${caseName} stdout: ${data}`);
            }
        });
        
        return new Promise<void>((resolve, reject) => {
            childProcess.stderr.on("data", function (data) {
                const output = data.toString('utf-8');
                if (childProcLogs) {
                    console.log(`${caseName} stderr: ${output}`);
                }
                //compensate for unhandled promise rejections
                if (output.indexOf("UnhandledPromiseRejectionWarning") !== -1) {
                    reject(output)
                }
            });
            childProcess.on("close", function (code) {
                if (childProcLogs) {
                    console.log(`${caseName} exit code: ${code}`);
                }

                if (code !== 0) {
                    reject(code);
                } else {
                    resolve();
                }
            });
        });
    }

    const compare = (sourcePath: string, destinationPath: string, globExpr: string[]) => {
        const source = ['test', sourcePath];
        const destination = ['test', destinationPath];
        const sourceFiles = new Set(glob
            .sync(expand(...source, ...globExpr))
            .filter(file => !file.includes('META-INF') && !file.includes('version-history'))
            .map(file => path.normalize(file).replace(expand(...source), '').toLowerCase())
            .sort());
        const destinationFiles = new Set(glob
            .sync(expand(...destination, ...globExpr))
            .filter(file => !file.includes('META-INF') && !file.includes('version-history'))
            .map(file => path.normalize(file).replace(expand(...destination), '').toLowerCase())
            .sort());

        expect(sourceFiles).toEqual(destinationFiles, `Source path ${sourcePath} does not match destination path ${destinationPath}`);
    }

    const expand = (...args:string[]) => path.join(currentPath, ...args);

    it("Convert XML project from tree to flat structure", async () => {
        try {
            await runCase("Project tree -> flat", [
                expand("bin", "vropkg"),
                '--in', 'tree',
                '--out', 'flat',
                '--srcPath', expand('test', 'com.vmware.pscoe.toolchain-expand'),
                '--destPath', expand('test', 'target-flat'),
                '--privateKeyPEM', fs.readFileSync(expand('test', 'private_key.pem')).toString(),
                '--certificatesPEM', fs.readFileSync(expand('test', 'cert.pem')).toString(),
            ]);
        } catch (error) {
            throw error;
        }

        await fs
            .createReadStream(expand('test', 'com.vmware.pscoe.toolchain.package'))
            .pipe(unzipper.Extract({ path: expand('test', 'target-flat.tmp') }))
            .promise();

        compare('target-flat.tmp', 'target-flat', ['elements', '**']);
    })

    it("Convert XML project from flat to tree structure", async () => {
        try {
            await runCase("Project flat -> tree", [
                expand("bin", "vropkg"),
                '--in', 'flat',
                '--out', 'tree',
                '--srcPath', expand('test', 'com.vmware.pscoe.toolchain.package'),
                '--destPath', expand('test', 'target-tree'),
                '--privateKeyPEM', fs.readFileSync(expand('test', 'private_key.pem')).toString(),
                '--certificatesPEM', fs.readFileSync(expand('test', 'cert.pem')).toString(),
            ]);
        } catch (error) {
            throw error;
        }

        compare('target-tree', 'com.vmware.pscoe.toolchain-expand', ['src', 'main', 'resources', '**']);
    })

});
