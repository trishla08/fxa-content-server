/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Attached clients are OAuth apps and devices
 *
 * It sorts items in order that is defined in FxA-89 feature description.
 */
define(function (require, exports, module) {
  'use strict';

  const Backbone = require('backbone');
  const Constants = require('lib/constants');
  const Device = require('models/device');
  const OAuthApp = require('models/oauth-app');
  const P = require('lib/promise');

  var AttachedClients = Backbone.Collection.extend({
    model: function(attrs, options) {
      if (attrs.clientType === Constants.CLIENT_TYPE_DEVICE) {
        return new Device(attrs, options);
      } else if (attrs.clientType === Constants.CLIENT_TYPE_OAUTH_APP) {
        return new OAuthApp(attrs, options);
      }
    },

    fetchClients (clientTypes = {}, user) {
      var account = user.getSignedInAccount();
      var fetchItems = [];

      if (clientTypes.devices) {
        fetchItems.push(user.fetchAccountDevices(account));
      }

      if (clientTypes.oAuthApps) {
        fetchItems.push(user.fetchAccountOAuthApps(account));
      }

      return P.all(fetchItems)
        .then((results) => {
          // need to reset and sync add the models,
          // Backbone cannot merge two simultaneous responses.
          this.reset();
          if (results) {
            results.forEach((items) => {
              this.add(items, {
                merge: true
              });
            });
          }
        });
    },

    comparator (a, b) {
      // 1. the current device is first.
      // 2. those with lastAccessTime are sorted in descending order
      // 3. the rest sorted in alphabetical order.
      if (a.get('isCurrentDevice')) {
        return -1;
      }
      if (b.get('isCurrentDevice')) {
        return 1;
      }
      // check lastAccessTime. If one has an access time and the other does
      // not, the one with the access time is automatically higher in the
      // list. If both have access times, sort in descending order, unless
      // access times are the same, then sort alphabetically.
      var aLastAccessTime = a.get('lastAccessTime');
      var bLastAccessTime = b.get('lastAccessTime');

      if (aLastAccessTime && bLastAccessTime &&
          aLastAccessTime !== bLastAccessTime) {
        return bLastAccessTime - aLastAccessTime;
      } else if (aLastAccessTime && ! bLastAccessTime) {
        return -1;
      } else if (! aLastAccessTime && bLastAccessTime) {
        return 1;
      }

      // neither has an access time, or access time is the same,
      // sort alphabetically

      var aName = (a.get('name') || '').trim().toLowerCase();
      var bName = (b.get('name') || '').trim().toLowerCase();

      if (aName < bName) {
        return -1;
      } else if (aName > bName) {
        return 1;
      }

      return 0;
    }

  });

  module.exports = AttachedClients;
});
