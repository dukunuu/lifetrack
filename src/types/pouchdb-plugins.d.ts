declare module 'pouchdb-adapter-idb';
declare module 'pouchdb-adapter-http';
declare module 'pouchdb-replication';
declare module 'pouchdb-find';
declare module 'pouchdb-quick-search';
declare module 'pouchdb-mapreduce-no-ddocs';

declare namespace PouchDB {
  interface Database<Content extends {} = {}> {
    search(options: {
      query?: string;
      fields: string[] | Record<string, number>;
      include_docs?: boolean;
      limit?: number;
      skip?: number;
      mm?: string;
      build?: boolean;
      destroy?: boolean;
      filter?: (doc: Content) => boolean;
    }): Promise<{
      rows: Array<{ id: string; doc?: Content; score?: number }>;
      total_rows?: number;
    }>;
  }
}
