import fetch from 'node-fetch';
import fs from 'fs/promises';
import chalk from 'chalk';
import decompress from 'decompress';
import path from "path";

const configFile = '.jsv2-client-updater.json';
const tempFolderPath = './.temp'
const tempFile = `${tempFolderPath}/temp.zip`;

async function createJsonConfigFile() {
    try {
        const defaultContent = JSON.stringify({ altVPath: '' }, null, 4);

        await fs.writeFile(`./${configFile}`, defaultContent, 'utf8');

        console.log(`
            ${chalk.green('A configuration file has been created.')}
            ${chalk.yellow('Please modify it with the path to the root of your alt:V launcher folder and re-execute this script.')}
        `);
    } catch(e) {console.error('Unable to create configuration file', e);
    }
}

async function getModuleVersion() {
    const response = await fetch('https://cdn.alt-mp.com/js-module-v2/dev/x64_win32/update.json', {
        headers: { "Accept": "application/json" }
    });

    const versionFile = await response.json();

    return versionFile.version;
}

async function downloadClientModuleFiles(version) {
    const githubDownloadURL = `https://github.com/altmp/altv-js-module-v2/releases/download/dev/${version}/js-module-v2-windows-client.zip`;

    const response = await fetch(githubDownloadURL);

    if(!response.ok) {
        throw new Error(`Error downloading client module: ${response.statusText}`);
    }

    await fs.mkdir(tempFolderPath, { recursive: true });

    await fs.writeFile(tempFile, Buffer.from(await response.arrayBuffer()));

}

async function extractClientModuleFiles() {
    return decompress(tempFile, tempFolderPath);
}

async function copyFilesToAltVLauncher(altVPath) {
    const files = [`${tempFolderPath}/dist-client-windows/modules/js-client-v2.dll`, `${tempFolderPath}/dist-client-windows/modules/js-client-v2.pdb`];
    const altVModulePath = path.join(altVPath, '/modules/js-client-v2');

    await fs.mkdir(altVModulePath, { recursive: true });

    await Promise.all(files.map(file => fs.copyFile(file, path.join(altVModulePath, path.basename(file)))));
}

async function deleteTempFiles() {
    const filesInTempFolder = await fs.readdir(tempFolderPath);

    const targetFiles = ['dist-client-windows', 'temp.zip'];

    const isOtherFilesInTempFolder = filesInTempFolder.some(file => !targetFiles.includes(file));

    if(isOtherFilesInTempFolder) {
        const deletePromises = targetFiles.map(file => fs.rm(path.join(tempFolderPath, file), { recursive: true }));
        await Promise.allSettled(deletePromises);
    } else {
        await fs.rm(tempFolderPath, { recursive: true });
    }
}

async function update() {
    try {
        const { altVPath } = JSON.parse(await fs.readFile(`./${configFile}`, 'utf8'));

        if(!altVPath) {
            console.error(chalk.red('Please add the path to your alt:V launcher folder in the ${configFile}.'));
            return;
        }

        const altVFolderFiles = await fs.readdir(altVPath);

        if(!altVFolderFiles.includes('altv.exe')) {
            console.error(chalk.red('The path indicated in the configuration file is not the alt:V launcher folder'));
            return;
        }

        try {
            const version = await getModuleVersion();

            if(!version) throw new Error('The fetched version is undefined');

            await downloadClientModuleFiles(version);
            await extractClientModuleFiles();
            await copyFilesToAltVLauncher(altVPath);

            console.log(chalk.green(`JS V2 client module successfully updated to version ${version}`));
        } catch(e) {
            console.error(e);
        }
    } catch(e) {
        if(e.code === 'ENOENT') {
            await createJsonConfigFile();
            return;
        }

        console.error('Error reading configuration file', e);
    }

    await deleteTempFiles()
}

update()