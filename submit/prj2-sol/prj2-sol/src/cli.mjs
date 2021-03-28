import DBGrades from './db-grades.mjs';

import { CourseGrades, AppError } from 'course-grades';
import getCourseInfo from 'courses-info';

import fs from 'fs';
import Path from 'path';
import readline from 'readline';


/************************* Top level routine ***************************/

const OUT_FMTS = [ 'text', 'js', 'json', 'json2' ]; 

export default async function go() {
  const isInteract = Path.basename(process.argv[1]).startsWith('interact');
  let outFmt = 'text';
  const args = process.argv.slice(2);
  const m = args.length > 0 && args[0].match(/^--out=(\w+)$/);
  if (m) {
    if (OUT_FMTS.indexOf(m[1]) < 1) usage();
    args.shift();
    outFmt = m[1];
  }
  if (isInteract) {
    if (args.length > 0) usage();
    await repl(new InMemoryGrades(), outFmt);
  }
  else {
    if (args.length === 0) usage();
    const dbUrl = args.shift();
    let grades;
    try {
      grades = await DBGrades.make(dbUrl);
      if (grades.errors) { errors(grades); process.exit(1); }
      await doArgs(grades, args, outFmt);
    }
    finally {
      if (grades) grades.close();
    }
  }
}

const CMD_USAGE = `
  command can be one of:
     add COURSE_ID EMAIL_ID,COL_ID,VALUE...
       Update COURSE_ID with triples (no space within each triple).
     clear
       Clear out all courses.
     help:
       Print this message.
     import COURSE_ID GRADES_JSON_PATH
       Set raw grades for COURSE_ID to data read from GRADES_JSON_PATH.
     query COURSE_ID [PROJECTION_SPEC|SELECTION_SPEC]...
       Return grades table (including stats) for COURSE_ID.
       Filter by COL_ID=VALUE SELECTION_SPEC and project by
       COL_ID PROJECTION_SPEC
     raw COURSE_ID
       Return raw grades (no stats) for COURSE_ID.
`;

function usage() {
  const prog = Path.basename(process.argv[1]);
  const isInteract = prog.startsWith('interact');
  if (isInteract) {
    console.error(`${prog} [--out=${OUT_FMTS.join('|')}]`);
  }
  else {
    console.error(`${prog} [--out=${OUT_FMTS.join('|')}] DB_URL CMD ...`);
    console.error(CMD_USAGE);		  
  }
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
  rl.on('line',
	async (line) => await doLine(grades, outFmt, line, rl));
  rl.prompt();
}

async function doLine(grades, outFmt, line, rl) {
  line = line.trim();
  if (line.length > 0) {
    const args = line.split(/\s+/);
    await doArgs(grades, args, outFmt, true);
  }
  rl.prompt();
}
  


/**************************** Process Args *****************************/

async function doArgs(grades, args, outFmt, isInteract=false) {
  const badArgsReport = isInteract ? () => console.error(CMD_USAGE) : usage;
  if (args.length < 1) badArgsReport();
  const cmd = args.shift();
  let result;
  switch (cmd) {
    case 'add': {
      if (args.length < 2) { badArgsReport(); break }
      const courseInfo = await getCourseInfo(args.shift());
      if (courseInfo.errors) return courseInfo;
      const triples =
        args.map(arg => arg.split(','))
	.map(([e, a, g]) => [e, a, Number(g)]);
      result = await grades.add(courseInfo, triples);
      break;
    }
    case 'clear':
      if (args.length > 0) { badArgsReport(); break }
      await grades.clear();
      break;      
    case 'import': {
      if (args.length !== 2) { badArgsReport(); break; }
      const courseInfo = await getCourseInfo(args.shift());
      if (courseInfo.errors) return courseInfo;
      const path = args[0].replace(/^(\~|\$HOME)/, process.env['HOME']);
      const json = await readJson(path);
      result = json.errors ? json : await grades.import(courseInfo, json);
      break;
    }
    case 'help':
      console.error(CMD_USAGE);
      break;
    case 'query': {
      if (args.length < 1) { badArgsReport(); break; }
      const courseInfo = await getCourseInfo(args.shift());
      if (courseInfo.errors) return courseInfo;
      const projectionSpec = [];
      const selectionSpec = {};
      for (const arg of args) {
	const m = arg.match(/^([^\=]+)=(.+)$/);
	if (m) {
	  selectionSpec[m[1]] = m[2];
	}
	else {
	  projectionSpec.push(arg);
	}
      }
      const options = { projectionSpec, selectionSpec };
      result = await grades.query(courseInfo, options);
      break;
    }
    case 'raw':
      if (args.length !== 1) { badArgsReport(); break; }
      const courseInfo = await getCourseInfo(args[0]);
      if (courseInfo.errors) return courseInfo;
      result = await grades.raw(courseInfo);
      break;
    default:
      badArgsReport();
      break;
  } //switch
  if (result) {
    if (result.errors) {
      errors(result);
    }
    else {
      outTable(result, outFmt);
    }
  }
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
      items.push(val.match(/^\-?\d+/) ? val.padStart(w) : val.padEnd(w));
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

/*************************** In-Memory Grades **************************/

class InMemoryGrades {
  constructor() {
    this._courses = {};
  }

  /** set all grades for courseId to rawGrades */
  async import(courseInfo, rawGrades) {
    const grades = await CourseGrades.make(courseInfo, rawGrades);
    if (grades.errors) return grades;
    this._courses[courseInfo.id] = grades;
  }

  /** add list of [emailId, colId, value] triples to grades for 
   *  courseId, replacing previous entries if any.
   */
  async add(courseInfo, triples) {
    const grades = this._getGrades(courseInfo);
    if (grades.errors) return grades;
    const newGrades = grades.add(triples);
    if (newGrades.errors) return newGrades;
    this._courses[courseInfo.id] = newGrades;
  }

  /** Clear out all courses */
  async clear() { this._courses = {}; }

  /** return grades for courseId including stats.  Returned
   *  grades are filtered as per options.selectionSpec and
   *  projected as per options.projectionSpec.
   */
  async query(courseInfo, options) {
    const grades = this._getGrades(courseInfo);
    return (grades.errors) ? grades : grades.query(options);
  }

  /** return raw grades without stats for courseId */
  async raw(courseInfo) { 
    const grades = this._getGrades(courseInfo);
    return (grades.errors) ? grades : grades.raw();
  }
  
  _getGrades(courseInfo) {
    const grades = this._courses[courseInfo.id];
    return (
      grades ||
      { errors: [ new AppError(`unknown course "${courseInfo.id}"`,
			       {code: 'BAD_VAL', widget: 'courseId'})]});
  }
}
  

/******************************* Utilities *****************************/

function readJson(path) {
  try {
    const text = fs.readFileSync(path, 'utf8');
    return JSON.parse(text);
  }
  catch (err) {
    const msg = `cannot read JSON at ${path}: ${err}`;
    return { errors: [ new AppError(msg, { code: 'FILE' }) ] };
  }
}

function errors(result) {
  for (const err of result.errors) console.error(err.toString()); 
}
  
