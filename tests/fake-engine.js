import { writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';

/** Control-boundary simulator only; it is not real container evidence. */
export async function fakeEngine(root, { name = 'docker', marker = 'default', exitCode = 0, foreign = false, workerState } = {}) {
  const binary = join(root, name), log = join(root, 'calls.jsonl');
  await writeFile(binary + '.config', JSON.stringify({ marker, exitCode, foreign, workerState }));
  await writeFile(binary, [
    '#!' + process.execPath,
    "import fs from 'node:fs';import {dirname} from 'node:path';import {fileURLToPath} from 'node:url';",
    "const binary=fileURLToPath(import.meta.url),root=dirname(binary),config=JSON.parse(fs.readFileSync(binary+'.config','utf8')),a=process.argv.slice(2),file=root+'/engine.json';",
    "const state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{containers:{},images:{}};",
    "fs.appendFileSync(root+'/calls.jsonl',JSON.stringify({args:a,marker:config.marker,host:process.env.DOCKER_HOST??null,context:process.env.DOCKER_CONTEXT??null})+'\\n');",
    "const labels=record=>config.foreign?{'com.deployproof.owner':'someone-else'}:(record?.labels??{});",
    "if(a[0]==='info')process.stdout.write(JSON.stringify('29.8.2'));",
    "else if(a[0]==='image'&&a[1]==='inspect'){if(a.includes('{{json .Config.Labels}}'))process.stdout.write(JSON.stringify(labels(state.images[a.at(-1)])));else process.stdout.write('sha256:'+'b'.repeat(64));}",
    "else if(a[0]==='create'){const name=a[a.indexOf('--name')+1];state.containers[name]={readOnly:a.includes('--read-only'),labels:Object.fromEntries(a.filter(x=>x.startsWith('com.deployproof.')).map(x=>x.split('=')))};process.stdout.write('a'.repeat(64));}",
    "else if(a[0]==='cp'){const target=a.at(-1).split(':')[0];if(state.containers[target]?.readOnly){process.stderr.write('container rootfs is marked read-only');process.exit(17);}}",
    "else if(a[0]==='commit'){const id='sha256:'+'c'.repeat(64);state.images[id]={labels:state.containers[a.at(-1)]?.labels};process.stdout.write(id);}",
    "else if(a[0]==='wait')process.stdout.write(String(config.exitCode));",
    "else if(a[0]==='inspect'){if(a.includes('{{json .State}}'))process.stdout.write(JSON.stringify(config.workerState??{Running:false,OOMKilled:false,ExitCode:config.exitCode}));else process.stdout.write(JSON.stringify(labels(state.containers[a.at(-1)])));}",
    "fs.writeFileSync(file,JSON.stringify(state));",
  ].join('\n'));
  await chmod(binary, 0o755);
  return { binary, log };
}
