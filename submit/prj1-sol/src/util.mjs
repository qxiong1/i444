export class AppError {

  constructor(msg, options={}) {
    this._msg = msg;
    this._options = options;
  }

  toString() {
    //const codePrefix =
    //  (this._options.code ?? `${this._options.code}: `) || '';
    //return `${codePrefix}${this._msg}`;
    return this._msg;
  }
}
