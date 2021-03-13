import Grades from './grades.mjs';

import fs from 'fs';
import Path from 'path';
import readline from 'readline';

/************************* Top level routine ***************************/

const OUT_FMTS = [ 'text', 'js', 'json', 'json2' ]; 

export default async function go() {
  const args = process.argv.slice(2);
  if (args.length !== 1 && args.length !== 2) usage();
  let outFmt = 'text';
  if (args.length == 2) {
    const m = args[0].match(/^--out=(\w+)$/);
    if (!m || OUT_FMTS.indexOf(m[1]) < 1) usage();
    outFmt = m[1];
  }
  const jsonPath = args.slice(-1)[0];
  const coursesInfo = readJson(jsonPath);
  const grades = Grades.make(coursesInfo);
  await repl(grades, outFmt);
}

function usage() {
  console.error(`${Path.basename(process.argv[1])} ` +
		`[--out=${OUT_FMTS.join('|')}] COURSES_JSON_PATH`);
  process.exit(1);
}

/******************************** REPL *********************************/

const PROMPT = '>> ';

async function repl(grades, outFmt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, //no ANSI terminal escapes
    prompt: PROMPT,
  });  
  rl.on('line', async (line) => await doLine(grades, outFmt, line, rl));
  rl.prompt();
}

//handler for a line
async function doLine(grades, outFmt, line, rl) {
  line = line.trim();
  if (line.length > 0) {
    const splits = line.split(/\s+/);
    const courseId = splits[0];
    const projectionSpec = [];
    const selectionSpec = {};
    for (const split of splits.slice(1)) {
      const m = split.match(/^([^\=]+)=(.+)$/);
      if (m) {
	selectionSpec[m[1]] = m[2];
      }
      else {
	projectionSpec.push(split);
      }
    }
    const options = { projectionSpec, selectionSpec };
    const result = await grades.query(courseId, options);
    if (result.errors) {
      for (const err of result.errors) { console.error(err.toString()); }
    }
    else {
      outTable(result[courseId], outFmt);
    }
  }
  rl.prompt();
}


/**************************** Output Routines **************************/

function outTable(table, outFmt) {
  switch (outFmt) {
    case 'text':
      outTextTable(table);
      break;
    case 'js':
      console.log(table);
      break;
    case 'json':
      console.log(JSON.stringify(table));
      break;
    case 'json2':
      console.log(JSON.stringify(table, null, 2));
      break;
  }
}

function outTextTable(table) {
  const out = (...args) => console.log(...args);
  const widths = colWidths(table);
  out(Object.keys(widths).map(k => k.padStart(widths[k])).join(' '));
  for (const row of table) {
    const items = [];
    for (const [k, w] of Object.entries(widths)) {
      const val = (row[k] ?? '').toString();
      items.push(val.match(/^\d+/) ? val.padStart(w) : val.padEnd(w));
    }
    out(items.join(' '));
  }
}
  
function colWidths(table) {
  const widths = {};
  for (const row of table) {
    for (const [k, v] of (Object.entries(row))) {
      widths[k] ??= k.length;
      const vLen = (v ?? '').toString().length;
      if (widths[k] < vLen) widths[k] = vLen;
    }
  }
  return widths;
}

/******************************* Utilities *****************************/

function readJson(path) {
  const text = fs.readFileSync(path, 'utf8');
  return JSON.parse(text);
}


