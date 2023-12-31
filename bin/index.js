import fetch from 'node-fetch';
import fs from 'fs/promises';
import chalk from 'chalk';
import decompress from 'decompress';
import path from "path";

const githubDownloadURL = `https://github.com/altmp/altv-js-module-v2/releases/latest/download/js-module-v2-windows-client.zip`;
const configFile = path.resolve('.jsv2-client-updater.json');
const tempFolderPath = path.resolve('./.temp')
const tempFile = path.resolve(tempFolderPath, 'temp.zip');

async function createJsonConfigFile() {
    try {
        const defaultContent = JSON.stringify({altVPath: ''}, null, 4);

        await fs.writeFile(`./${configFile}`, defaultContent, 'utf8');

        console.log(`
            ${chalk.green('A configuration file has been created.')}
            ${chalk.yellow('Please modify it with the path to the root of your alt:V launcher folder and re-execute this script.')}
        `);
    } catch (e) {
        console.error('Unable to create configuration file', e);
    }
}

async function getAltVFolderPath() {
    try {
        const {altVPath} = JSON.parse(await fs.readFile(configFile, 'utf8'));

        if (!altVPath) {
            console.error(chalk.red(`Please add the path to your alt:V launcher folder in the ${configFile}.`));
            return;
        }

        return altVPath;
    } catch (e) {
        if (e.code === 'ENOENT') {
            await createJsonConfigFile();
            return;
        }

        console.error('Error reading configuration file', e);
    }
}

async function downloadClientModuleFiles() {
    const response = await fetch(githubDownloadURL);

    if (!response.ok) {
        throw new Error(`Error downloading client module: ${response.statusText}`);
    }

    await fs.mkdir(tempFolderPath, {recursive: true});

    await fs.writeFile(tempFile, Buffer.from(await response.arrayBuffer()));

}

async function extractClientModuleFiles() {
    return decompress(tempFile, tempFolderPath);
}

async function copyFilesToAltVLauncher(altVPath) {
    const files = [`${tempFolderPath}/dist-client-windows/modules/js-client-v2.dll`, `${tempFolderPath}/dist-client-windows/modules/js-client-v2.pdb`];
    const altVModulePath = path.resolve(altVPath, 'modules', 'js-client-v2');

    await fs.mkdir(altVModulePath, {recursive: true});

    await Promise.all(files.map(file => fs.copyFile(file, path.join(altVModulePath, path.basename(file)))));
}

async function deleteTempFiles() {
    const filesInTempFolder = await fs.readdir(tempFolderPath);

    const targetFiles = ['dist-client-windows', 'temp.zip'];

    const isOtherFilesInTempFolder = filesInTempFolder.some(file => !targetFiles.includes(file));

    if (isOtherFilesInTempFolder) {
        const deletePromises = targetFiles.map(file => fs.rm(path.join(tempFolderPath, file), {recursive: true}));
        await Promise.allSettled(deletePromises);
    } else {
        await fs.rm(tempFolderPath, {recursive: true});
    }
}

async function update() {
    const altVPath = await getAltVFolderPath();

    if (!altVPath) return;

    try {
        await fs.access(path.join(altVPath, 'altv.exe'));
    } catch (e) {
        console.error(chalk.red('The path indicated in the configuration file is not the alt:V launcher folder'));
        return;
    }

    try {
        await downloadClientModuleFiles();
        await extractClientModuleFiles();
        await copyFilesToAltVLauncher(altVPath);

        console.log(chalk.green(`JS V2 client module successfully updated`));
    } catch (e) {
        console.error(e);
    }

    await deleteTempFiles()
}

update()