declare module 'node-dbf' {
  import { EventEmitter } from 'events';

  interface DBFHeader {
    version: number;
    numberOfRecords: number;
    fields: DBFFieldDescriptor[];
    dateOfLastUpdate: Date;
  }

  interface DBFFieldDescriptor {
    name: string;
    type: string;
    length: number;
    decimalPlaces: number;
  }

  class Parser extends EventEmitter {
    constructor(filename: string, options?: { encoding?: string });

    parse(): this;

    on(event: 'start', listener: (parser: Parser) => void): this;
    on(event: 'header', listener: (header: DBFHeader) => void): this;
    on(event: 'record', listener: (record: any) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'paused', listener: () => void): this;

    header: DBFHeader;
    filename: string;
    encoding: string;
  }

  export = Parser;
}
