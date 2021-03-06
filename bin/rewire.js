#!/usr/bin/env node

/**
 * Copyright 2014 Netsend.
 *
 * This file is part of Mastersync.
 *
 * Mastersync is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * Mastersync is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with Mastersync. If not, see <https://www.gnu.org/licenses/>.
 */

'use strict';

var program = require('commander');

var _db = require('./_db');
var VersionedCollection = require('../lib/versioned_collection');

program
  .version('0.0.1')
  .usage('[-v] -d database -c collection src dst parents...')
  .description('copy a version to a new version and use certain parents')
  .option('-d, --database <database>', 'name of the database')
  .option('-c, --collection <collection>', 'name of the collection to repair')
  .option('')
  .option('src', 'source version')
  .option('dst', 'destination version')
  .option('parents', 'one or more parent versions to set on the new item')
  .option('')
  .option('    --config <file>', 'config file with db parameters, defaults to config/production.json')
  .option('-p, --pe', 'perspective, defaults to local perspective')
  .option('-n  --new-version <version>', 'new version, defaults to dst or random if the same as src')
  .option('-s, --save', 'insert the new item in the snapshot')
  .option('-v, --verbose', 'verbose')
  .parse(process.argv);

if (!program.args[1]) {
  program.help();
}

var config = program.config || __dirname + './../config/production.json';

var src = program.args[0];
var dst = program.args[1];
var parents = program.args.slice(2);

// if relative, prepend current working dir
if (config[0] !== '/') {
  config = process.cwd() + '/' + config;
}

config = require(config);

config.dbName = program.database || config.dbName;
config.collection = program.collection || config.collection;

if (!config.dbName) { program.help(); }
if (!config.collection) { program.help(); }

var debug = !!program.verbose;

function run(db) {
  var vc = new VersionedCollection(db, config.collection, { debug: debug });

  var selector = { '_id._v': src, '_id._pe': program.pe || vc.localPerspective };
  vc._snapshotCollection.findOne(selector, function(err, item) {
    if (err) {
      console.error('error:', err.message);
      process.exit(1);
    }

    if (!item) {
      console.error('error: src not found');
      process.exit(1);
    }

    if (program.newVersion) {
      item._id._v = program.newVersion;
    } else if (src === dst) {
      item._id._v = VersionedCollection._generateRandomVersion();
    } else {
      item._id._v = dst;
    }
    item._id._pa = parents;

    console.log(JSON.stringify(item));

    if (program.save) {
      vc._addAllToDAG([{ item: item }], function(err) {
        if (err) {
          console.error('error:', err.message);
          process.exit(1);
        }
        db.close();
      });
    } else {
      db.close();
    }
  });
}

// open database
_db(config, function(err, db) {
  if (err) { throw err; }
  run(db);
});
