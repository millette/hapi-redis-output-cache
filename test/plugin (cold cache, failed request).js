'use strict';

var expect = require('expect.js'),
    Hoek   = require('hoek'),
    plugin = require('../index.js'),
    redis  = require('redis').createClient(1234, '127.0.0.1');

var originalHandler           = function() {},
    onCacheMissHandlerInvoked = false;

var requestPrototype = {
    route: {
        method: 'get',
        settings: {
            handler: originalHandler
        }
    },
    url: {
        path: '/resources/1'
    }
};

var server = {
    ext: function(name, handler) {
        this[name] = handler;
    }
};

describe('plugin (cold cache, successful request)', function() {
    before(function(done) {
        redis.del('get|/resources/1');

        plugin.register(server, {
            host: '127.0.0.1',
            port: 1234,
            ttl: 60,
            onCacheMiss: function() { onCacheMissHandlerInvoked = true; }
        }, function() {
            done();
        });
    });

    describe('given cold cache', function() {
        var req = Hoek.clone(requestPrototype);

        describe('when onPreHandler is executed', function() {
            before(function(done) {
                server.onPreHandler(req, { 'continue': function() { done(); } });
            });

            it('should mark output cache as stale', function() {
                expect(req.outputCache.isStale).to.equal(true);
            });

            it('should set output cache data to null', function() {
                expect(req.outputCache.data).to.equal(null);
            });

            it('should not override original route handler', function() {
                expect(req.route.settings.handler).to.equal(originalHandler);
            });
        });

        describe('when onPreResponse is executed', function() {
            var cachedResponse;

            before(function(done) {
                req.response = {};

                server.onPreResponse(req, {
                    'continue': function() {
                        redis.get('get|/resources/1', function(err, data) {
                            cachedResponse = data;
                            done();
                        });
                    }
                });
            });

            it('should not invoke onCacheMiss handler', function() {
                expect(onCacheMissHandlerInvoked).to.equal(false);
            });

            it('should not cache failed response', function() {
                expect(cachedResponse).to.equal(null);
            });
        });
    });
});