/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Route to report CSP Violations to metrics
 */

const _ = require('lodash');
const joi = require('joi');
const url = require('url');
const validation = require('../validation');

const INTEGER_TYPE = validation.TYPES.INTEGER;
const STRING_TYPE = validation.TYPES.STRING;
const URL_TYPE = validation.TYPES.URL;

const BODY_SCHEMA = {
  'csp-report': joi.object().keys({
    // CSP 2, 3 required
    'blocked-uri': URL_TYPE.required(),
    // CSP 2, 3 optional
    'column-number': INTEGER_TYPE.min(0).optional(),
    // CSP 3 required, but not always sent
    'disposition': STRING_TYPE.optional(),
    // CSP 2, 3 required
    'document-uri': URL_TYPE.required(),
     // CSP 2 required, but not always sent
    'effective-directive': STRING_TYPE.optional(),
    // CSP 2 optional
    'line-number': INTEGER_TYPE.optional(),
    // CSP 2, 3 required
    'original-policy': STRING_TYPE.required(),
    // CSP 2, 3 required, can be empty
    'referrer': STRING_TYPE.allow('').required(),
    // Not in spec but sent by Firefox, can be empty
    'script-sample': STRING_TYPE.allow('').optional(),
    // CSP 2, 3 optional, can be empty
    'source-file': STRING_TYPE.allow('').optional(),
    // CSP 2, 3 required, but not always sent
    'status-code': INTEGER_TYPE.min(0).optional(),
    // CSP 2, 3 reuqired
    'violated-directive': STRING_TYPE.required()
  }).required()
};

module.exports = function (options) {
  options = options || {};

  var write = options.write || function (entry) {
    process.stderr.write(JSON.stringify(entry) + '\n');
  };

  return {
    method: 'post',
    path: options.path,
    validate: {
      body: BODY_SCHEMA
    },
    process: function (req, res) {
      res.json({ success: true });

      var today = new Date();
      today.setMinutes(0, 0, 0);
      var report = req.body['csp-report'];

      var entry = {
        agent: req.get('User-Agent'),
        blocked: report['blocked-uri'],
        column: report['column-number'],
        line: report['line-number'],
        op: options.op || 'server.csp',
        referrer: stripPIIFromUrl(report['referrer']),
        sample: report['script-sample'],
        source: stripPIIFromUrl(report['source-file']),
        time: today.toISOString(),
        violated: report['violated-directive'],
      };

      write(entry);
    }
  };
};

function stripPIIFromUrl(urlToScrub) {
  if (! urlToScrub || ! _.isString(urlToScrub)) {
    return '';
  }

  var parsedUrl;

  try {
    parsedUrl = url.parse(urlToScrub, true);
  } catch (e) {
    // failed to parse the given url
    return '';
  }

  if (! parsedUrl.query.email && ! parsedUrl.query.uid) {
    return urlToScrub;
  }

  delete parsedUrl.query.email;
  delete parsedUrl.query.uid;

  // delete parsedUrl.search or else format returns the old querystring.
  delete parsedUrl.search;

  return url.format(parsedUrl);
}
